import type { AttributeValue } from "@opentelemetry/api"
import { trace } from "@opentelemetry/api"
import { otelMiddleware } from "@tanstack/ai/middlewares/otel"

// A single tracer for all chat activity. The name becomes the OTel
// instrumentation scope; export is driven by the `gen_ai.*` attributes the
// middleware sets, not by this name.
const tracer = trace.getTracer("tanstack-ai")

export type ChatTraceContext = {
  /** Groups every message of one conversation into a Langfuse session. */
  sessionId?: string
  /** Attributes the trace to a user, when the app has one. */
  userId?: string
  /** Free-form labels for filtering traces in the Langfuse dashboard. */
  tags?: string[]
  /** Langfuse prompt name, to link generations to a managed prompt version. */
  promptName?: string
  /** Langfuse prompt version that produced this generation. */
  promptVersion?: number
  /** Trace name shown in the Langfuse UI; defaults to the assistant chat. */
  traceName?: string
}

// Stable, human-readable trace name so traces are findable/filterable in the
// Langfuse UI (beats the middleware default of `chat <model>`).
const DEFAULT_TRACE_NAME = "page-builder-assistant"

/**
 * Builds the TanStack AI OpenTelemetry middleware wired for Langfuse.
 *
 * The middleware emits a root chat span plus one generation span per agent-loop
 * iteration and one span per tool call, all carrying `gen_ai.*` semantic
 * conventions (model, token usage, finish reason) and Langfuse-native
 * `langfuse.*` input/output attributes. `captureContent` records the actual
 * prompts and completions so traces are readable in the UI — enable masking via
 * the LangfuseSpanProcessor `mask` option if PII becomes a concern.
 *
 * Session/user/tag context is stamped on the root span at creation time via
 * `attributeEnricher`, which is deterministic under streaming (unlike wrapping
 * the async stream in a context manager). The managed-prompt link is stamped on
 * each generation (iteration) span, where Langfuse expects it.
 */
export function langfuseChatMiddleware(ctx: ChatTraceContext = {}) {
  return otelMiddleware({
    tracer,
    captureContent: true,
    attributeEnricher: (info) => {
      // Trace-level context lives on the root chat span.
      if (info.kind === "chat") {
        const attrs: Record<string, AttributeValue> = {
          "langfuse.trace.name": ctx.traceName ?? DEFAULT_TRACE_NAME,
        }
        if (ctx.sessionId) attrs["session.id"] = ctx.sessionId
        if (ctx.userId) attrs["user.id"] = ctx.userId
        if (ctx.tags?.length) attrs["langfuse.trace.tags"] = ctx.tags
        return attrs
      }
      // Prompt link belongs on the generation (iteration) observation.
      if (info.kind === "iteration" && ctx.promptName) {
        const attrs: Record<string, AttributeValue> = {
          "langfuse.observation.prompt.name": ctx.promptName,
        }
        if (ctx.promptVersion != null)
          attrs["langfuse.observation.prompt.version"] = ctx.promptVersion
        return attrs
      }
      return {}
    },
  })
}
