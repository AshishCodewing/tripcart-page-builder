import type { SystemPrompt } from "@tanstack/ai"
import type { OpenRouterSystemPromptMetadata } from "@tanstack/ai-openrouter"
import { describe, expect, it } from "vitest"

import {
  buildCodegenMessages,
  buildCodegenSystemPrompts,
  type CodegenRequest,
  parseGeneratedCode,
} from "./codegen"

const PROMPT = "You are the codegen agent."

type ObjPrompt = Exclude<SystemPrompt<OpenRouterSystemPromptMetadata>, string>

function req(overrides: Partial<CodegenRequest>): CodegenRequest {
  return { action: "create", plan: "build a hero", ...overrides }
}

// buildCodegenSystemPrompts is typed `string | { content, metadata? }` but only
// ever emits the object form; narrow so assertions can read `.content`, failing
// loudly if that invariant breaks.
function build(overrides: Partial<CodegenRequest>): ObjPrompt[] {
  return buildCodegenSystemPrompts(PROMPT, req(overrides)).map((p) => {
    if (typeof p === "string")
      throw new Error("expected a structured system prompt, got a string")
    return p
  })
}

describe("parseGeneratedCode", () => {
  it("returns the trimmed inner content of a well-formed tag", () => {
    expect(
      parseGeneratedCode("<generated_code>  <div/>  </generated_code>")
    ).toBe("<div/>")
  })

  it("returns null when there is no tag", () => {
    expect(parseGeneratedCode("just some prose")).toBeNull()
  })

  it("returns null when the inner content is empty or whitespace", () => {
    expect(
      parseGeneratedCode("<generated_code>   </generated_code>")
    ).toBeNull()
    expect(parseGeneratedCode("<generated_code></generated_code>")).toBeNull()
  })

  it("returns the content of the FIRST tag pair (non-greedy)", () => {
    expect(
      parseGeneratedCode(
        "<generated_code>one</generated_code><generated_code>two</generated_code>"
      )
    ).toBe("one")
  })

  it("ignores chatter surrounding the tag and preserves multiline inner", () => {
    const text = "Sure!\n<generated_code>\n<a/>\n<b/>\n</generated_code>\nDone."
    expect(parseGeneratedCode(text)).toBe("<a/>\n<b/>")
  })
})

describe("buildCodegenSystemPrompts", () => {
  it("always returns 2 entries: ephemeral static prompt + uncached task body", () => {
    const prompts = build({ action: "create" })
    expect(prompts).toHaveLength(2)
    expect(prompts[0].content).toBe(PROMPT)
    expect(prompts[0].metadata?.cache_control?.type).toBe("ephemeral")
    expect("metadata" in prompts[1]).toBe(false)
  })

  it("emits a Target position block for `add` with targetIds", () => {
    const [, body] = build({
      action: "add",
      targetIds: ["comp-1"],
      position: "beforeInside",
      componentName: "Card",
    })
    expect(body.content).toContain("## Target position")
    expect(body.content).toContain('beforeInside the element with id "comp-1"')
    expect(body.content).toContain("New component name: Card")
  })

  it("emits SELECTED_COMPONENT_IDS for `edit` with targetIds", () => {
    const [, body] = build({ action: "edit", targetIds: ["a", "b"] })
    expect(body.content).toContain("SELECTED_COMPONENT_IDS: a, b")
  })

  it("omits the media-query section without widthMedia devices", () => {
    const noDevices = build({})[1]
    expect(noDevices.content).not.toContain("## Allowed media queries")

    const noWidth = build({ devices: [{ name: "Desktop" }] })[1]
    expect(noWidth.content).not.toContain("## Allowed media queries")
  })

  it("emits a media-query section for devices with widthMedia", () => {
    const [, body] = build({
      devices: [{ name: "Mobile", widthMedia: "768px" }],
    })
    expect(body.content).toContain("## Allowed media queries")
    expect(body.content).toContain("@media (max-width: 768px)")
  })

  it("places CURRENT_CODE (page HTML/CSS) as the LAST part of the task body", () => {
    const [, body] = build({
      action: "edit",
      targetIds: ["a"],
      pageHtml: "<main/>",
      pageCss: ".x{}",
    })
    expect(body.content).toContain("# CURRENT_CODE")
    expect(body.content).toContain("## Current page HTML")
    expect(body.content).toContain("## Current page CSS")
    expect(body.content.indexOf("# CURRENT_CODE")).toBeGreaterThan(
      body.content.indexOf("SELECTED_COMPONENT_IDS")
    )
    expect(body.content.trimEnd().endsWith("```")).toBe(true)
  })
})

describe("buildCodegenMessages", () => {
  it("uses the trimmed userMessage as the user turn when present", () => {
    const [user, assistant] = buildCodegenMessages(
      req({ userMessage: "  make it blue  ", plan: "the plan" })
    )
    expect(user).toEqual({ role: "user", content: "make it blue" })
    expect(assistant.role).toBe("assistant")
    expect(assistant.content.startsWith("Plan: ")).toBe(true)
  })

  it("falls back to the plan when userMessage is absent or blank", () => {
    expect(buildCodegenMessages(req({ plan: "the plan" }))[0].content).toBe(
      "the plan"
    )
    expect(
      buildCodegenMessages(req({ userMessage: "   ", plan: "the plan" }))[0]
        .content
    ).toBe("the plan")
  })
})
