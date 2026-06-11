import { describe, expect, it } from "vitest"

import type { ComponentDefinition } from "@/lib/plugins/react-renderer/project/types"
import { unwrapTemplateRoot } from "@/lib/cms/template-shape"

describe("unwrapTemplateRoot", () => {
  it("passes a normal content root through by reference", () => {
    const root: ComponentDefinition = {
      tagName: "section",
      components: [{ tagName: "p" }],
    }
    expect(unwrapTemplateRoot(root)).toBe(root)
  })

  it("rewrites a type:wrapper root to a div, preserving children", () => {
    const child: ComponentDefinition = { tagName: "p", content: "hi" }
    const root: ComponentDefinition = {
      type: "wrapper",
      attributes: { "data-x": "y" },
      components: [child],
    }
    const out = unwrapTemplateRoot(root)
    expect(out.tagName).toBe("div")
    expect(out.type).toBeUndefined()
    expect(out.attributes).toEqual({
      "data-x": "y",
      "data-tc-template-root": "true",
    })
    expect(out.components).toEqual([child])
    expect(out.components?.[0]).toBe(child)
  })

  it("unwraps a tag-based document root case-insensitively (uppercase BODY)", () => {
    const root: ComponentDefinition = {
      tagName: "BODY",
      components: [{ tagName: "main" }],
    }
    const out = unwrapTemplateRoot(root)
    expect(out.tagName).toBe("div")
    expect(out.attributes?.["data-tc-template-root"]).toBe("true")
  })

  it("unwraps html and head roots too", () => {
    expect(unwrapTemplateRoot({ tagName: "html" }).tagName).toBe("div")
    expect(unwrapTemplateRoot({ tagName: "head" }).tagName).toBe("div")
  })

  it("gives an unwrapped root with no components an empty array", () => {
    const out = unwrapTemplateRoot({ type: "wrapper" })
    expect(out.components).toEqual([])
  })

  it("starts attributes fresh when the wrapper had none", () => {
    const out = unwrapTemplateRoot({ type: "wrapper" })
    expect(out.attributes).toEqual({ "data-tc-template-root": "true" })
  })
})
