// Pure-data registry of the interactive web-component tag names + a check for
// whether a GrapesJS project uses any of them. Server-safe: NO imports of the
// web-component classes (those `extend HTMLElement` and can't be evaluated on
// the server), so preview/publish render paths can import this to decide
// whether to load the web-component bundle at all.

export const INTERACTIVE_TAGS = ["tc-tabs"] as const

/** True if the serialized project data contains any interactive custom element,
 * so callers can lazily load the web-component runtime only when it's needed. */
export function usesInteractiveComponents(projectData: unknown): boolean {
  if (!projectData) return false
  const json =
    typeof projectData === "string" ? projectData : JSON.stringify(projectData)
  return INTERACTIVE_TAGS.some((tag) => json.includes(`"tagName":"${tag}"`))
}
