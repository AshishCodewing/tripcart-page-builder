// Next.js instrumentation hook — runs once at server startup for each runtime.
// The OpenTelemetry Node SDK that backs Langfuse only works in the Node.js
// runtime, so we load the tracer setup lazily and only there. See
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node")
  }
}
