import { describe, expect, it } from "vitest"

import {
  MAX_PROJECT_BYTES,
  parseProjectPayload,
  validateComponentPayload,
  validateProjectPayload,
} from "@/lib/cms/project-payload"

// Mirrors the shape `editor.getProjectData()` posts from the editor shell.
const minimalProject = {
  pages: [{ frames: [{ component: { tagName: "div", components: [] } }] }],
  styles: [],
}

describe("validateProjectPayload", () => {
  it("accepts a realistic minimal project", () => {
    expect(validateProjectPayload(minimalProject)).toEqual(minimalProject)
  })

  it("accepts an empty project ({} — Page.data's schema default)", () => {
    expect(validateProjectPayload({})).toEqual({})
  })

  it("passes through arbitrary extra keys at every level", () => {
    const project = {
      customTopLevel: { anything: true },
      dataSources: [{ id: "ds1" }],
      pages: [
        {
          id: "p1",
          name: "Home",
          customPageKey: 1,
          frames: [
            {
              width: "100%",
              customFrameKey: null,
              component: {
                tagName: "section",
                classes: ["hero", { name: "dark", private: 1 }],
                style: { color: "red" },
                customComponentKey: [1, 2],
                components: [{ type: "textnode", content: "hi" }],
              },
            },
          ],
        },
      ],
      styles: [{ selectors: ["#x"], style: { margin: "0" }, custom: true }],
      assets: ["https://cdn.example.com/a.png", { src: "/b.png", width: 10 }],
    }
    expect(validateProjectPayload(project)).toEqual(project)
  })

  it("accepts a deeply nested component tree", () => {
    let node: Record<string, unknown> = { tagName: "span" }
    for (let depth = 0; depth < 5; depth++) {
      node = { tagName: "div", components: [node] }
    }
    const project = { pages: [{ frames: [{ component: node }] }] }
    expect(validateProjectPayload(project)).toEqual(project)
  })

  it("rejects structural breaks in the skeleton", () => {
    expect(() => validateProjectPayload({ pages: "nope" })).toThrow(
      /Invalid project payload/
    )
    expect(() => validateProjectPayload({ styles: 42 })).toThrow(
      /Invalid project payload/
    )
    expect(() =>
      validateProjectPayload({ pages: [{ frames: [{ component: [] }] }] })
    ).toThrow(/Invalid project payload/)
  })

  it("rejects non-object roots", () => {
    expect(() => validateProjectPayload(null)).toThrow(
      /Invalid project payload/
    )
    expect(() => validateProjectPayload([minimalProject])).toThrow(
      /Invalid project payload/
    )
  })
})

describe("parseProjectPayload", () => {
  it("parses and validates a JSON string", () => {
    expect(parseProjectPayload(JSON.stringify(minimalProject))).toEqual(
      minimalProject
    )
  })

  it("keeps the legacy parse-failure message verbatim", () => {
    expect(() => parseProjectPayload("not json")).toThrow(
      "Invalid project payload — could not parse JSON."
    )
  })

  it("labels the parse-failure message for template callers", () => {
    expect(() => parseProjectPayload("not json", "template")).toThrow(
      "Invalid template payload — could not parse JSON."
    )
  })

  it("fails fast on oversized payloads, before parsing", () => {
    const huge = `"${"x".repeat(MAX_PROJECT_BYTES)}`
    expect(() => parseProjectPayload(huge)).toThrow(
      "Project payload too large."
    )
  })
})

describe("validateComponentPayload", () => {
  it("accepts a bare component with nested children", () => {
    const subtree = {
      tagName: "section",
      attributes: { class: "hero" },
      components: [{ tagName: "h1", components: [] }],
    }
    expect(validateComponentPayload(subtree)).toEqual(subtree)
  })

  it("rejects arrays, null, and primitives", () => {
    expect(() => validateComponentPayload([{ tagName: "div" }])).toThrow(
      /Invalid component payload/
    )
    expect(() => validateComponentPayload(null)).toThrow(
      /Invalid component payload/
    )
    expect(() => validateComponentPayload("div")).toThrow(
      /Invalid component payload/
    )
  })
})
