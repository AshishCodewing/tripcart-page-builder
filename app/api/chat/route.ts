import { chat, toServerSentEventsResponse } from "@tanstack/ai"
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

  const body = await request.json()

  try {
    const stream = chat({
      adapter: openRouterText("minimax/minimax-m3"),
      messages: body.messages,
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
