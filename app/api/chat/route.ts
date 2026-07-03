import {
  chat,
  chatParamsFromRequest,
  maxIterations,
  toServerSentEventsResponse,
} from "@tanstack/ai"
import { openRouterText } from "@tanstack/ai-openrouter"

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

  try {
    const stream = chat({
      adapter: openRouterText("minimax/minimax-m3"),
      messages: params.messages,
      threadId: params.threadId,
      runId: params.runId,
      parentRunId: params.parentRunId,
      agentLoopStrategy: maxIterations(6),
      abortController,
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
