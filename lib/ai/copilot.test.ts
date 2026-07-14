import type { SystemPrompt } from "@tanstack/ai"
import type { OpenRouterSystemPromptMetadata } from "@tanstack/ai-openrouter"
import { describe, expect, it } from "vitest"

import { buildCopilotSystemPrompts, type EditorContext } from "./copilot"

const PROMPT = "You are the TripCart copilot."

type Meta = OpenRouterSystemPromptMetadata
type ObjPrompt = Exclude<SystemPrompt<Meta>, string>

// The builder's return type is `string | { content, metadata? }`, but it never
// emits a bare string — narrow to the object form so assertions can read
// `.content`/`.metadata`, and fail loudly if that invariant ever breaks.
function build(ctx?: EditorContext): ObjPrompt[] {
  return buildCopilotSystemPrompts(PROMPT, ctx).map((p) => {
    if (typeof p === "string")
      throw new Error("expected a structured system prompt, got a string")
    return p
  })
}

describe("buildCopilotSystemPrompts", () => {
  it("emits exactly the static tier, ephemeral-cached, for empty context", () => {
    const prompts = build()
    expect(prompts).toHaveLength(1)
    expect(prompts[0].content).toContain(PROMPT)
    expect(prompts[0].content).toContain("## Available interactive blocks")
    expect(prompts[0].metadata?.cache_control?.type).toBe("ephemeral")
  })

  it("adds the website-state tier (ephemeral) when page export is present", () => {
    const prompts = build({
      pageHtml: "<div>hi</div>",
      pageCss: ".a{color:red}",
      devices: [{ name: "Mobile", widthMedia: "768px" }],
    })
    expect(prompts).toHaveLength(2)
    const state = prompts[1]
    expect(state.content.startsWith("# Current website state")).toBe(true)
    expect(state.content).toContain("```html\n<div>hi</div>\n```")
    expect(state.content).toContain("```css\n.a{color:red}\n```")
    // Tier 1 stays cacheable — it's byte-stable until the site is edited.
    expect(state.metadata?.cache_control?.type).toBe("ephemeral")
  })

  it("adds the selection tier with NO cache_control (volatile)", () => {
    const prompts = build({
      selectedComponent: { id: "c1", html: "<span/>" },
      selectedIds: ["c1"],
      currentPage: { id: "p1", name: "Home" },
      isNewProject: false,
    })
    expect(prompts).toHaveLength(2)
    const selection = prompts[1]
    expect(selection.content.startsWith("# Current selection")).toBe(true)
    expect("metadata" in selection).toBe(false)
  })

  it("orders [static, website-state, selection] and caches only the stable prefix", () => {
    const prompts = build({
      pageHtml: "<div/>",
      pageCss: ".a{}",
      devices: [{ widthMedia: "600px" }],
      selectedComponent: { id: "c1", html: "<span/>" },
      currentPage: { id: "p1", name: "Home" },
      isNewProject: true,
    })
    expect(prompts).toHaveLength(3)
    expect(prompts[0].content).toContain(PROMPT)
    expect(prompts[1].content.startsWith("# Current website state")).toBe(true)
    expect(prompts[2].content.startsWith("# Current selection")).toBe(true)
    // Cache-prefix stability contract: only the two stable tiers carry it.
    expect(prompts[0].metadata?.cache_control?.type).toBe("ephemeral")
    expect(prompts[1].metadata?.cache_control?.type).toBe("ephemeral")
    expect("metadata" in prompts[2]).toBe(false)
  })

  it("emits the selection tier for isNewProject:false but not when omitted", () => {
    const withFlag = build({ isNewProject: false })
    expect(withFlag).toHaveLength(2)
    expect(withFlag[1].content).toContain("Is New Project (empty canvas)")

    const withoutFlag = build({})
    expect(withoutFlag).toHaveLength(1)
  })
})
