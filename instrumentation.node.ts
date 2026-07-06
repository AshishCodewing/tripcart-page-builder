// Node.js-only OpenTelemetry setup that exports LLM spans to Langfuse.
//
// Registered from instrumentation.ts at startup (Node runtime only). Also
// imported directly by the chat route so it can `forceFlush()` the processor
// before a serverless function terminates — both paths share this one module
// instance, so the tracer provider is registered exactly once.
import { LangfuseSpanProcessor } from "@langfuse/otel"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"

// Reads LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY / LANGFUSE_BASE_URL from the
// environment. Its default filter exports any span carrying `gen_ai.*`
// attributes — which is every span our TanStack AI otel middleware emits.
export const langfuseSpanProcessor = new LangfuseSpanProcessor()

const tracerProvider = new NodeTracerProvider({
  spanProcessors: [langfuseSpanProcessor],
})

tracerProvider.register()
