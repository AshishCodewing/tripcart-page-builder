// Pure-data manifest of the interactive web-component blocks. Server-safe: NO
// imports of the web-component classes (those `extend HTMLElement` and can't be
// evaluated on the server), so render paths and the AI prompt builders can all
// import it. Single source of truth consumed by:
//   - preview/publish render (usesInteractiveComponents → lazy-load the runtime)
//   - AI code-gen prompt (full emit contract — lib/ai/codegen.ts)
//   - AI orchestrator prompt (routing summary — lib/ai/copilot.ts)

export type InteractiveBlock = {
  /** Custom element tag, e.g. "tc-tabs". */
  tag: string
  /** Human label shown to the orchestrator. */
  label: string
  /** One line: when the LLM should reach for this block. */
  whenToUse: string
  /** Canonical minimal markup the code-gen agent must emit. Deliberately omits
   * ids / aria-* / hidden / tabindex — the web component wires those at runtime
   * (self-heal), so the AI can't get them wrong. */
  example: string
}

export const INTERACTIVE_BLOCKS: InteractiveBlock[] = [
  {
    tag: "tc-tabs",
    label: "Tabs",
    whenToUse:
      "a set of labelled panels where only one shows at a time (tabbed sections, feature/plan comparisons, grouped FAQs).",
    example: [
      "<tc-tabs>",
      '  <div role="tablist">',
      "    <button role=\"tab\"><span>Overview</span></button>",
      "    <button role=\"tab\"><span>Pricing</span></button>",
      "  </div>",
      '  <div class="tc-tabs__panels">',
      '    <div role="tabpanel"><p>Overview content…</p></div>',
      '    <div role="tabpanel"><p>Pricing content…</p></div>',
      "  </div>",
      "</tc-tabs>",
    ].join("\n"),
  },
]

/** Custom element tags, derived from the manifest. */
export const INTERACTIVE_TAGS: string[] = INTERACTIVE_BLOCKS.map((b) => b.tag)

/** True if the serialized project data contains any interactive custom element,
 * so callers can lazily load the web-component runtime only when it's needed. */
export function usesInteractiveComponents(projectData: unknown): boolean {
  if (!projectData) return false
  const json =
    typeof projectData === "string" ? projectData : JSON.stringify(projectData)
  return INTERACTIVE_TAGS.some((tag) => json.includes(`"tagName":"${tag}"`))
}

/** Short one-line-per-block summary for the orchestrator (routing/awareness
 * only — the full emit contract lives in the code-gen prompt). Empty string
 * when there are no blocks. */
export function describeInteractiveBlocks(): string {
  return INTERACTIVE_BLOCKS.map((b) => `- ${b.label}: ${b.whenToUse}`).join("\n")
}
