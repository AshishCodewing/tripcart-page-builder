import {
  chat,
  chatParamsFromRequest,
  maxIterations,
  mergeAgentTools,
  toServerSentEventsResponse,
} from "@tanstack/ai"
import { openRouterText } from "@tanstack/ai-openrouter"
import { reconstructChat, withPersistence } from "@tanstack/ai-persistence"
import { after } from "next/server"
import { langfuseSpanProcessor } from "@/instrumentation.node"
import { hasCredits, INSUFFICIENT_CREDITS } from "@/lib/billing/gate"
import {
  createBillingMiddleware,
  settledWithTimeout,
} from "@/lib/billing/usage-middleware"
import {
  buildCopilotSystemPrompts,
  fetchCopilotPrompt,
  type EditorContext,
} from "@/lib/ai/copilot"
import { withMessageWindow } from "@/lib/ai/message-window"
import { chatPersistence, deleteThread } from "@/lib/ai/persistence"
import { threadScopeKey, tryParseThreadId } from "@/lib/ai/thread-id"
import { copilotToolDefinitions } from "@/lib/ai/tools"
import { langfuseChatMiddleware } from "@/lib/ai/tracing"
import { tryResolveContentTenantId } from "@/lib/cms/content-scope"

// The adapter types model ids as a literal union; ours comes from the
// Langfuse prompt config at runtime, so widen deliberately.
type OpenRouterModelId = Parameters<typeof openRouterText>[0]

// The tenant the client claims, sent as a header so it reaches the hydration
// GET as well as the POST body (see components/ai/chat.tsx).
const TENANT_HEADER = "x-tc-tenant-id"

/**
 * A conversation id safe to hand to third parties (Langfuse, OpenRouter).
 *
 * The real thread id is a signed bearer capability: possession is what
 * authorizes `GET /api/chat`, so it must not be copied into a trace store.
 * The unsigned `kind:contentId` scope groups a conversation just as well.
 */
function traceSessionId(threadId: string | undefined): string | undefined {
  if (!threadId) return undefined
  const scope = tryParseThreadId(threadId)
  return scope ? threadScopeKey(scope) : undefined
}

/**
 * Gate for reading or deleting a stored conversation.
 *
 * This is NOT authentication — the app has no session yet (see the TODO(auth)
 * below), so it cannot be. What it does enforce is that the caller presents a
 * thread id this server actually minted, for an entity that actually exists,
 * whose real tenant (read from the CMS tables, never from the request) matches
 * the tenant the caller claims.
 *
 * Both failure modes return the same answer so the endpoint cannot be used to
 * enumerate valid content ids. Replace the whole thing with
 * `session.tenantId === thread.tenantId` once there is a session.
 */
async function authorizeThread(
  threadId: string,
  request: Request
): Promise<boolean> {
  const scope = tryParseThreadId(threadId)
  if (!scope) return false

  const owner = await tryResolveContentTenantId(scope.kind, scope.contentId)
  if (owner === undefined) return false
  // A global template (owner === null) is unscoped and needs no match.
  if (owner !== null && request.headers.get(TENANT_HEADER) !== owner) {
    return false
  }
  return true
}

/**
 * Hydration. `useChat` with `persistence: true` calls this on mount via the
 * connection's `hydrate(threadId)` — a JSON GET against this same URL, issued
 * by `fetchServerSentEvents` itself, so there is no client fetch code.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)

  // The connection adapter shares one URL across three verbs. `joinRun` GETs
  // `?runId=…&offset=…` expecting an SSE replay from a delivery-durability log
  // we have not wired; answering it with hydration JSON would park the client
  // on a stream that never arrives. Fail the join fast instead.
  if (url.searchParams.has("runId")) {
    return new Response(null, { status: 404 })
  }

  const response = await reconstructChat(chatPersistence, request, {
    authorize: authorizeThread,
  })
  if (!response.ok) return response

  // findActiveRun is implemented honestly in the store, but without delivery
  // durability there is nothing to tail — and a serverless invocation that
  // dies mid-run leaves its row stuck at 'running' forever, which would make
  // every later mount wait on a ghost. Suppress the cursor here, at the
  // transport edge, rather than lying in the store. Remove once a durable
  // event log exists.
  const body = (await response.json()) as Record<string, unknown>
  return Response.json(
    { ...body, activeRun: null },
    { headers: { "cache-control": "no-store" } }
  )
}

/**
 * Clear. `ChatClient.clear()` is client-local, and under `persistence: true`
 * there is no client persistor to tell the server — so without this the next
 * mount would restore everything the user just cleared.
 */
export async function DELETE(request: Request) {
  const threadId = new URL(request.url).searchParams.get("threadId")
  if (!threadId) return new Response(null, { status: 400 })
  if (!(await authorizeThread(threadId, request))) {
    return new Response(null, { status: 403 })
  }

  await deleteThread(threadId)
  return new Response(null, { status: 204 })
}

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

  // Rejects a non-conforming AG-UI body by THROWING a ready-made 400 Response
  // (not an Error), and this sits outside the try/catch below — so an
  // unhandled throw here would surface as an opaque 500 instead of the 400 it
  // already built.
  let params: Awaited<ReturnType<typeof chatParamsFromRequest>>
  try {
    params = await chatParamsFromRequest(request)
  } catch (error) {
    if (error instanceof Response) return error
    throw error
  }

  const abortController = new AbortController()
  // A closed client connection must cancel the agent loop: otherwise the run
  // (and its OpenRouter spend + billing) continues after the user hit Stop.
  request.signal.addEventListener("abort", () => abortController.abort())

  // Structured GrapesJS editor state the client attaches per message (see
  // components/ai/chat.tsx). Absent on the very first render / non-editor calls.
  const editorContext = (params.forwardedProps?.editorContext ??
    {}) as EditorContext

  // Which tenant to bill. null (e.g. global template editing) means the run
  // is unmetered. TODO(auth): client-supplied — replace with server-side
  // tenant resolution once the routes have a session.
  const forwardedTenantId = params.forwardedProps?.tenantId
  const tenantId =
    typeof forwardedTenantId === "string" && forwardedTenantId.length > 0
      ? forwardedTenantId
      : null

  if (tenantId && !(await hasCredits(tenantId))) {
    return new Response(JSON.stringify(INSUFFICIENT_CREDITS), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    })
  }

  const billing = createBillingMiddleware({ tenantId, source: "copilot" })

  try {
    // Static system prompt from Langfuse (cached + fallback); split with the
    // dynamic editor state into cache-tiered systemPrompts.
    const prompt = await fetchCopilotPrompt()

    const stream = chat({
      // The window is applied at the adapter, NOT via middleware: the engine
      // writes a middleware-transformed config back into ctx.messages and the
      // persistence middleware saves exactly that, so trimming there would
      // truncate the stored transcript on every turn.
      adapter: withMessageWindow(
        openRouterText(prompt.model as OpenRouterModelId)
      ),
      // Full history — persistence treats a non-empty array as authoritative
      // and overwrites the stored thread with it on finish.
      messages: params.messages,
      systemPrompts: buildCopilotSystemPrompts(prompt.text, editorContext),
      // The isomorphic tool definitions (no execute) drive the runtime: they
      // carry needsApproval, which the client-declared AG-UI shapes do not.
      // Execution happens client-side (components/ai/copilot-tools.ts) via
      // the ClientToolRequest path; the merge keeps any future client-only
      // tools working.
      tools: mergeAgentTools(copilotToolDefinitions, params.tools),
      // Sticky routing: pin a conversation to the same OpenRouter provider
      // instance so the cache_control prefix stays warm across turns and
      // agent-loop iterations. Same id as the Langfuse session for symmetry.
      modelOptions: { sessionId: traceSessionId(params.threadId) },
      threadId: params.threadId,
      runId: params.runId,
      parentRunId: params.parentRunId,
      // Tool-approval decisions the client sends back for a paused run. The
      // persistence middleware matches these against the thread's pending
      // interrupts and throws when a pause has no matching resume, so dropping
      // this breaks every approval-gated tool.
      resume: params.resume,
      agentLoopStrategy: maxIterations(6),
      middleware: [
        // FIRST: its onConfig loads the stored transcript / pending interrupts
        // and merges them into the config the later middleware observe.
        withPersistence(chatPersistence),
        billing.middleware,
        langfuseChatMiddleware({
          // The unsigned scope, not the thread id: the thread id is a bearer
          // capability for GET /api/chat and must not be handed to a
          // third-party trace store.
          sessionId: traceSessionId(params.threadId),
          tags: ["page-builder"],
          promptName: prompt.name,
          promptVersion: prompt.version,
        }),
      ],
      abortController,
    })

    // Serverless functions can freeze the moment the response is returned, so
    // settle the billing charge (bounded) and flush buffered spans once the
    // streamed response has fully drained. flush() also covers runs that
    // pause for client-side tools — the engine fires no terminal hook for
    // those, so without it the pausing leg's usage would go unbilled.
    after(async () => {
      await settledWithTimeout(billing.flush())
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
