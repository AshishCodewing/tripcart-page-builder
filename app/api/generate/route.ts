import { chat, streamToText } from "@tanstack/ai"
import { openRouterText } from "@tanstack/ai-openrouter"
import { after } from "next/server"
import { z } from "zod"
import { langfuseSpanProcessor } from "@/instrumentation.node"
import { hasCredits, INSUFFICIENT_CREDITS } from "@/lib/billing/gate"
import { resolveBilledTenant } from "@/lib/billing/resolve-tenant"
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
  // Which tenant to bill; absent for unmetered contexts (global templates).
  // TODO(auth): client-supplied — resolved and validated by
  // lib/billing/resolve-tenant.ts (the single seam for future session auth).
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

  // TODO(auth): the candidate is still client-supplied —
  // lib/billing/resolve-tenant.ts is the single seam to swap for session-based
  // resolution once the routes have a session.
  const tenantResult = await resolveBilledTenant(parsed.data.tenantId)
  if ("error" in tenantResult) {
    return jsonError(400, "Unknown tenant")
  }
  const { tenantId } = tenantResult
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

    const generate = (retryMessages: typeof messages) => {
      const billing = createBillingMiddleware({ tenantId, source: "codegen" })
      chargeFlushes.push(billing.flush)
      return streamToText(
        chat({
          adapter: openRouterText(prompt.model as OpenRouterModelId),
          messages: retryMessages,
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
      )
    }

    let raw = await generate(messages)
    let html = parseGeneratedCode(raw)
    if (!html) {
      // One corrective retry: the model broke the sentinel contract.
      raw = await generate([
        ...messages,
        { role: "assistant" as const, content: raw.slice(0, 2000) },
        {
          role: "user" as const,
          content:
            "Your output violated the contract. Respond again with the FULL result wrapped in a single <generated_code> tag and nothing outside it.",
        },
      ])
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
