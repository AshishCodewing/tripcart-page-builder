import { chat, streamToText } from "@tanstack/ai"
import { openRouterText } from "@tanstack/ai-openrouter"
import { after } from "next/server"
import { z } from "zod"
import { langfuseSpanProcessor } from "@/instrumentation.node"
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
})

// The adapter types model ids as a literal union; the id here comes from the
// Langfuse prompt config at runtime, so widen deliberately — OpenRouter
// itself accepts any valid model string.
type OpenRouterModelId = Parameters<typeof openRouterText>[0]

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
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

  try {
    const prompt = await fetchCodegenPrompt()
    const systemPrompts = buildCodegenSystemPrompts(prompt.text, req)
    const messages = buildCodegenMessages(req)

    const generate = (retryMessages: typeof messages) =>
      streamToText(
        chat({
          adapter: openRouterText(prompt.model as OpenRouterModelId),
          messages: retryMessages,
          systemPrompts,
          // Same provider pinning as the chat route so the static-guardrail
          // prefix stays cache-warm across a session's generations.
          modelOptions: { sessionId: req.threadId },
          middleware: [
            langfuseChatMiddleware({
              sessionId: req.threadId,
              tags: ["page-builder", "codegen"],
              promptName: prompt.name,
              promptVersion: prompt.version,
              traceName: "page-builder-codegen",
            }),
          ],
        })
      )

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

    after(async () => {
      await langfuseSpanProcessor.forceFlush()
    })

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
