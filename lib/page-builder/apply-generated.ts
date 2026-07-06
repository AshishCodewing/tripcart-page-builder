// Client-only: applies AI-generated HTML/CSS (from /api/generate) to the
// GrapesJS canvas. Uses DOMParser, so it must run in the browser — it is
// called from the copilot's client tool handlers (components/ai/chat.tsx).
import type { Component, Editor } from "grapesjs"
import type { CodegenAction, CodegenPosition } from "@/lib/ai/codegen"

export type ApplyGeneratedInput = {
  action: CodegenAction
  /** Sentinel-stripped payload returned by /api/generate. */
  html: string
  /** add: component id to position the new element(s) against. */
  targetId?: string
  /** add: placement relative to targetId (defaults to afterInside). */
  position?: CodegenPosition
}

export type ApplyGeneratedResult = {
  ok: boolean
  /** One-line outcome for the orchestrator loop (never the HTML itself). */
  summary: string
  appliedIds: string[]
  error?: string
}

/** Splits a generated payload into CSS text and top-level elements. The HTML
 * parser hoists leading <style> tags into <head>, so styles are collected
 * document-wide before reading body children. */
function parsePayload(html: string): { css: string; elements: Element[] } {
  const doc = new DOMParser().parseFromString(html, "text/html")
  const css = Array.from(doc.querySelectorAll("style"))
    .map((s) => {
      const text = s.textContent ?? ""
      s.remove()
      return text
    })
    .join("\n")
    .trim()
  return { css, elements: Array.from(doc.body.children) }
}

function describe(components: Component[]): string {
  const names = components
    .map((c) => c.get("attributes")?.["data-gjs-name"] ?? c.getName())
    .filter(Boolean)
    .slice(0, 3)
  return names.join(", ")
}

/**
 * Applies generated markup to the canvas. All mutations happen in one
 * synchronous pass so GrapesJS's undo manager condenses them into a single
 * undo cycle (verified against 0.22 — one Ctrl+Z reverts an AI change).
 */
export function applyGenerated(
  editor: Editor,
  input: ApplyGeneratedInput
): ApplyGeneratedResult {
  const fail = (error: string): ApplyGeneratedResult => ({
    ok: false,
    summary: error,
    appliedIds: [],
    error,
  })

  let parsed: { css: string; elements: Element[] }
  try {
    parsed = parsePayload(input.html)
  } catch (e) {
    return fail(`Generated HTML could not be parsed: ${String(e)}`)
  }
  const { css, elements } = parsed
  if (elements.length === 0 && !css) {
    return fail("Generated payload contained no elements or styles")
  }

  const wrapper = editor.getWrapper()
  if (!wrapper) return fail("Editor canvas is not ready")

  const applied: Component[] = []
  const skipped: string[] = []

  try {
    if (input.action === "create") {
      if (wrapper.components().length > 0) {
        return fail(
          "Page is not empty — refusing to overwrite it with a full-page generation"
        )
      }
      for (const el of elements) applied.push(...wrapper.append(el.outerHTML))
    }

    if (input.action === "add") {
      const target = input.targetId
        ? wrapper.find(`#${CSS.escape(input.targetId)}`)[0]
        : undefined
      const position = input.position ?? "afterInside"
      const html = elements.map((el) => el.outerHTML).join("")
      if (!target || target === wrapper) {
        applied.push(...wrapper.append(html))
      } else if (position === "beforeInside") {
        applied.push(...target.append(html, { at: 0 }))
      } else if (position === "afterInside") {
        applied.push(...target.append(html))
      } else {
        const parent = target.parent() ?? wrapper
        const at = target.index() + (position === "after" ? 1 : 0)
        applied.push(...parent.append(html, { at }))
      }
    }

    if (input.action === "edit") {
      for (const el of elements) {
        const existing = el.id
          ? wrapper.find(`#${CSS.escape(el.id)}`)[0]
          : undefined
        if (!existing) {
          // Un-anchored top-level elements in edit mode are contract
          // violations; skipping beats dumping content at a random spot.
          skipped.push(el.id || el.tagName.toLowerCase())
          continue
        }
        const replaced = existing.replaceWith(el.outerHTML)
        applied.push(...(Array.isArray(replaced) ? replaced : [replaced]))
      }
      if (applied.length === 0) {
        return fail(
          `No generated element matched an existing component id (got: ${skipped.join(", ")})`
        )
      }
    }

    if (css) editor.addStyle(css)
  } catch (e) {
    return fail(`Applying generated code failed: ${String(e)}`)
  }

  if (applied.length > 0) editor.select(applied[0])

  const parts = [
    applied.length > 0 &&
      `${input.action === "edit" ? "Updated" : "Added"} ${applied.length} element(s): ${describe(applied)}`,
    css && "styles applied",
    skipped.length > 0 && `skipped unmatched: ${skipped.join(", ")}`,
  ].filter(Boolean)

  return {
    ok: true,
    summary: parts.join("; "),
    appliedIds: applied.map((c) => String(c.getId())),
  }
}
