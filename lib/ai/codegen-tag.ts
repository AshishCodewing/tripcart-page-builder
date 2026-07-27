// Client-safe half of the codegen contract. `lib/ai/codegen.ts` instantiates a
// `LangfuseClient` at module scope, so anything the browser needs — here, the
// sentinel tag the streaming preview parses — has to live outside it.

/** Wrapper tag the codegen model must emit its output inside. */
export const GENERATED_CODE_TAG = "generated_code"
