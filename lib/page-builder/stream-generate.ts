// Client-only: streams a full-page generation from /api/generate over SSE,
// driving a throttled live preview while the model types, and resolving with
// the authoritative sentinel-stripped HTML for the real commit. Used by the
// copilot's generatePage tool (components/ai/copilot-tools.ts).
// Type-only from codegen.ts (erased at build); the tag comes from the
// client-safe module so the server-only LangfuseClient stays out of the bundle.
import type { CodegenRequest } from "@/lib/ai/codegen"
import { GENERATED_CODE_TAG } from "@/lib/ai/codegen-tag"

type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; html: string; model?: string; promptVersion?: number }
  | { type: "error"; error: string }

type StreamGenerateOptions = {
  /** Throttled callback with the sentinel-stripped buffer so far (cosmetic). */
  onPreview?: (html: string) => void
  /** Aborts the underlying request (e.g. user hit Stop). */
  signal?: AbortSignal
}

const OPEN_TAG = `<${GENERATED_CODE_TAG}>`
const CLOSE_TAG = `</${GENERATED_CODE_TAG}>`
const THROTTLE_MS = 120

/** Extracts the payload inside <generated_code> from a partial raw buffer, for
 * preview only. Drops any preamble before the open tag and the closing tag once
 * it lands; a partial trailing close tag is harmless (innerHTML ignores it). */
function previewFrom(raw: string): string {
  const start = raw.indexOf(OPEN_TAG)
  if (start === -1) return ""
  let inner = raw.slice(start + OPEN_TAG.length)
  const end = inner.indexOf(CLOSE_TAG)
  if (end !== -1) inner = inner.slice(0, end)
  return inner
}

/**
 * POSTs a create request with `stream: true` and consumes the SSE response.
 * Resolves with the committed HTML from the `done` event. The `onPreview`
 * callback is fired on the leading edge and then at most every ~120ms.
 */
export async function streamGenerate(
  body: CodegenRequest,
  { onPreview, signal }: StreamGenerateOptions = {}
): Promise<{ html: string }> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  })

  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `Code generation failed (HTTP ${res.status})`)
  }

  // Leading + trailing throttle so the canvas isn't re-rendered per delta.
  let latest = ""
  let lastEmit = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const emit = () => {
    lastEmit = Date.now()
    onPreview?.(latest)
  }
  const schedulePreview = (html: string) => {
    if (!onPreview) return
    latest = html
    const elapsed = Date.now() - lastEmit
    if (elapsed >= THROTTLE_MS) {
      emit()
    } else if (timer === null) {
      timer = setTimeout(() => {
        timer = null
        emit()
      }, THROTTLE_MS - elapsed)
    }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  let raw = ""
  let result: { html: string } | null = null

  try {
    outer: while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        const line = frame.split("\n").find((l) => l.startsWith("data:"))
        if (!line) continue
        const evt = JSON.parse(line.slice(5).trim()) as StreamEvent
        if (evt.type === "delta") {
          raw += evt.text
          schedulePreview(previewFrom(raw))
        } else if (evt.type === "done") {
          result = { html: evt.html }
          break outer
        } else if (evt.type === "error") {
          throw new Error(evt.error)
        }
      }
    }
  } finally {
    if (timer !== null) clearTimeout(timer)
    reader.cancel().catch(() => {})
  }

  if (!result) throw new Error("Code generation stream ended without a result")
  return result
}
