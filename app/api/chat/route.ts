import {
  chat,
  chatParamsFromRequest,
  maxIterations,
  toServerSentEventsResponse,
} from "@tanstack/ai"
import { openRouterText } from "@tanstack/ai-openrouter"
import { after } from "next/server"
import { langfuseSpanProcessor } from "@/instrumentation.node"
import {
  buildCopilotSystemPrompts,
  fetchCopilotPrompt,
  type EditorContext,
} from "@/lib/ai/copilot"
import { langfuseChatMiddleware } from "@/lib/ai/tracing"

// Cap the history sent to the model; older turns add cost without improving
// answers grounded in the (always-fresh) editor context. TanStack AI has no
// pruning helper, and slicing is enough at this message volume.
const MAX_HISTORY_MESSAGES = 10

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "OPENROUTER_API_KEY not configured",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
  }

  const params = await chatParamsFromRequest(request)
  const abortController = new AbortController()

  // Structured GrapesJS editor state the client attaches per message (see
  // components/ai/chat.tsx). Absent on the very first render / non-editor calls.
  const editorContext = (params.forwardedProps?.editorContext ??
    {}) as EditorContext

  try {
    // Static system prompt from Langfuse (cached + fallback); split with the
    // dynamic editor state into cache-tiered systemPrompts.
    const prompt = await fetchCopilotPrompt()

    const stream = chat({
      adapter: openRouterText("minimax/minimax-m3"),
      messages: params.messages.slice(-MAX_HISTORY_MESSAGES),
      systemPrompts: buildCopilotSystemPrompts(prompt.text, editorContext),
      // Sticky routing: pin a conversation to the same OpenRouter provider
      // instance so the cache_control prefix stays warm across turns and
      // agent-loop iterations. Same id as the Langfuse session for symmetry.
      modelOptions: { sessionId: params.threadId },
      threadId: params.threadId,
      runId: params.runId,
      parentRunId: params.parentRunId,
      agentLoopStrategy: maxIterations(6),
      middleware: [
        langfuseChatMiddleware({
          sessionId: params.threadId,
          tags: ["page-builder"],
          promptName: prompt.name,
          promptVersion: prompt.version,
        }),
      ],
      abortController,
    })

    // Serverless functions can freeze the moment the response is returned, so
    // flush buffered spans once the streamed response has fully drained.
    after(async () => {
      await langfuseSpanProcessor.forceFlush()
    })

    return toServerSentEventsResponse(stream)
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An error occurred",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
  }
}
