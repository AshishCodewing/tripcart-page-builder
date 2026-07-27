import { chat, streamToText } from "@tanstack/ai"
import { openRouterText } from "@tanstack/ai-openrouter"
import { after } from "next/server"
import { z } from "zod"
import { langfuseSpanProcessor } from "@/instrumentation.node"
import { hasCredits, INSUFFICIENT_CREDITS } from "@/lib/billing/gate"
import {
  createBillingMiddleware,
  settledWithTimeout,
} from "@/lib/billing/usage-middleware"
import {
  buildCodegenMessages,
  buildCodegenSystemPrompts,
  fetchCodegenPrompt,
  parseGeneratedCode,
  type CodegenRequest,
} from "@/lib/ai/codegen"
import { langfuseChatMiddleware } from "@/lib/ai/tracing"

// The code-generation endpoint behind the copilot's code tools (plan 017).
// One call here = one generation by the strong code-gen model; the chat
// orchestrator never sees the HTML produced. The client tool handler sends
// fresh editor state and applies the returned markup to the canvas by id.

const bodySchema = z.object({
  action: z.enum(["create", "add", "edit"]),
  plan: z.string().min(1).max(4000),
  userMessage: z.string().max(8000).optional(),
  pageHtml: z.string().max(400_000).optional(),
  pageCss: z.string().max(400_000).optional(),
  targetIds: z.array(z.string()).max(50).optional(),
  position: z
    .enum(["before", "beforeInside", "afterInside", "after"])
    .optional(),
  componentName: z.string().max(200).optional(),
  devices: z
    .array(
      z.object({
        name: z.string().optional(),
        width: z.string().optional(),
        widthMedia: z.string().optional(),
      })
    )
    .max(10)
    .optional(),
  threadId: z.string().max(200).optional(),
  // Opt into a Server-Sent-Events response that streams the model's raw deltas
  // for a live canvas preview. Honored for full-page creates only; other
  // actions fall through to the buffered JSON path.
  stream: z.boolean().optional(),
  // Which tenant to bill; absent for unmetered contexts (global templates).
  // TODO(auth): client-supplied — replace with server-side tenant resolution
  // once the routes have a session.
  tenantId: z.string().max(200).optional(),
})

// The adapter types model ids as a literal union; the id here comes from the
// Langfuse prompt config at runtime, so widen deliberately — OpenRouter
// itself accepts any valid model string.
type OpenRouterModelId = Parameters<typeof openRouterText>[0]

function jsonError(status: number, error: string, code?: string) {
  return new Response(JSON.stringify(code ? { error, code } : { error }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return jsonError(500, "OPENROUTER_API_KEY not configured")
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return jsonError(400, `Invalid request: ${parsed.error.issues[0]?.message}`)
  }
  const req: CodegenRequest = parsed.data

  const tenantId = parsed.data.tenantId ?? null
  if (tenantId && !(await hasCredits(tenantId))) {
    return jsonError(402, INSUFFICIENT_CREDITS.error, INSUFFICIENT_CREDITS.code)
  }

  const abortController = new AbortController()
  // A closed client connection must cancel the generation: otherwise the run
  // (and its OpenRouter spend + billing) continues after the user hit Stop.
  request.signal.addEventListener("abort", () => abortController.abort())

  // One middleware (= one charge) per real model call: the corrective retry
  // below is a second full generation and must be billed separately.
  const chargeFlushes: Array<() => Promise<void>> = []
  // Registered before any generation so a thrown error can't skip it: the
  // callback reads chargeFlushes at flush time (after the response), so
  // charges pushed inside the try are included; an early throw with an empty
  // array resolves immediately. This is what settles an already-incurred
  // charge and flushes Langfuse spans on the error path.
  after(async () => {
    await settledWithTimeout(Promise.all(chargeFlushes.map((f) => f())))
    await langfuseSpanProcessor.forceFlush()
  })

  try {
    const prompt = await fetchCodegenPrompt()
    const systemPrompts = buildCodegenSystemPrompts(prompt.text, req)
    const messages = buildCodegenMessages(req)

    // One model call = one billing charge. Returns the raw chat() stream;
    // callers either drain it to text (streamToText) or forward its deltas.
    const makeStream = (callMessages: typeof messages) => {
      const billing = createBillingMiddleware({ tenantId, source: "codegen" })
      chargeFlushes.push(billing.flush)
      return chat({
        adapter: openRouterText(prompt.model as OpenRouterModelId),
        messages: callMessages,
        systemPrompts,
        // Same provider pinning as the chat route so the static-guardrail
        // prefix stays cache-warm across a session's generations.
        modelOptions: { sessionId: req.threadId },
        middleware: [
          billing.middleware,
          langfuseChatMiddleware({
            sessionId: req.threadId,
            tags: ["page-builder", "codegen"],
            promptName: prompt.name,
            promptVersion: prompt.version,
            traceName: "page-builder-codegen",
          }),
        ],
        abortController,
      })
    }

    // Corrective-retry messages when the first attempt broke the sentinel
    // contract. This retry is buffered (never streamed): the violation is only
    // detectable after the whole output is seen.
    const retryMessagesFrom = (raw: string) => [
      ...messages,
      { role: "assistant" as const, content: raw.slice(0, 2000) },
      {
        role: "user" as const,
        content:
          "Your output violated the contract. Respond again with the FULL result wrapped in a single <generated_code> tag and nothing outside it.",
      },
    ]

    // Streamed path (full-page creates only): forward raw model deltas to the
    // client for a live preview, then emit an authoritative `done` payload.
    // The preview is cosmetic; the client commits `done.html`, so the retry
    // contract below is identical to the buffered path.
    if (parsed.data.stream && req.action === "create") {
      const encoder = new TextEncoder()
      const body = new ReadableStream({
        async start(controller) {
          const send = (obj: unknown) =>
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)
            )
          try {
            let raw = ""
            for await (const chunk of makeStream(messages)) {
              if (abortController.signal.aborted) break
              if (chunk.type === "TEXT_MESSAGE_CONTENT" && chunk.delta) {
                raw += chunk.delta
                send({ type: "delta", text: chunk.delta })
              }
            }
            let html = parseGeneratedCode(raw)
            if (!html && !abortController.signal.aborted) {
              const retryRaw = await streamToText(
                makeStream(retryMessagesFrom(raw))
              )
              html = parseGeneratedCode(retryRaw)
            }
            if (html) {
              send({
                type: "done",
                html,
                model: prompt.model,
                promptVersion: prompt.version,
              })
            } else if (!abortController.signal.aborted) {
              send({
                type: "error",
                error: "Code generation produced no <generated_code> payload",
              })
            }
          } catch (e) {
            if (!abortController.signal.aborted) {
              send({
                type: "error",
                error:
                  e instanceof Error ? e.message : "Code generation failed",
              })
            }
          } finally {
            controller.close()
          }
        },
        cancel() {
          abortController.abort()
        },
      })
      return new Response(body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    }

    // Buffered path (add/edit, and any non-streamed request): drain to text,
    // parse, retry once, return one JSON blob — unchanged behavior.
    let raw = await streamToText(makeStream(messages))
    let html = parseGeneratedCode(raw)
    if (!html) {
      raw = await streamToText(makeStream(retryMessagesFrom(raw)))
      html = parseGeneratedCode(raw)
    }

    if (!html) {
      return jsonError(
        422,
        "Code generation produced no <generated_code> payload"
      )
    }
    return new Response(
      JSON.stringify({
        html,
        model: prompt.model,
        promptVersion: prompt.version,
      }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    return jsonError(
      500,
      error instanceof Error ? error.message : "Code generation failed"
    )
  }
}
