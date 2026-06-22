import { describe, expect, it } from "vitest"

import { POST_FIELD_TYPES, bindPostTemplate, formatPostDate } from "./post-template"
import type { ComponentDefinition } from "@/lib/plugins/react-renderer/project/types"

const POST = {
  title: "Hello World",
  publishedAt: new Date("2026-03-14T00:00:00Z"),
  featuredImage: "/uploads/hero.jpg" as string | null,
}

const BODY: ComponentDefinition[] = [
  { tagName: "p", content: "First paragraph" },
  { tagName: "p", content: "Second paragraph" },
]

const title = (): ComponentDefinition => ({
  type: POST_FIELD_TYPES.title,
  tagName: "h1",
  attributes: { id: "t1", class: "tc-post-title" },
})
const date = (): ComponentDefinition => ({
  type: POST_FIELD_TYPES.date,
  tagName: "time",
})
const image = (): ComponentDefinition => ({
  type: POST_FIELD_TYPES.featuredImage,
  tagName: "img",
  attributes: { class: "tc-post-featured-image", alt: "" },
})
const slot = (): ComponentDefinition => ({
  type: POST_FIELD_TYPES.contentSlot,
  tagName: "div",
  attributes: { id: "body", class: "tc-content-slot" },
})

describe("bindPostTemplate", () => {
  it("binds title + date as content and clears components", () => {
    const root: ComponentDefinition = {
      tagName: "article",
      components: [title(), date(), slot()],
    }
    const bound = bindPostTemplate(root, POST, BODY)
    const [t, d] = bound.components!

    expect(t.content).toBe("Hello World")
    expect(t.components).toEqual([])
    // Author's chosen tag + id/class preserved (heading semantics, styling).
    expect(t.tagName).toBe("h1")
    expect(t.attributes).toEqual({ id: "t1", class: "tc-post-title" })

    expect(d.content).toBe(formatPostDate(POST.publishedAt))
    expect(d.tagName).toBe("time")
  })

  it("pours the body into the first content slot only", () => {
    const root: ComponentDefinition = {
      tagName: "article",
      components: [slot(), slot()],
    }
    const bound = bindPostTemplate(root, POST, BODY)
    const [first, second] = bound.components!

    expect(first.components).toEqual(BODY)
    expect(second.components).toEqual([])
  })

  it("appends the body at the root when there is no slot (and preserves field binds)", () => {
    const root: ComponentDefinition = {
      tagName: "article",
      components: [title()],
    }
    const bound = bindPostTemplate(root, POST, BODY)

    expect(bound.components).toHaveLength(3) // title + 2 body paragraphs
    expect(bound.components![0].content).toBe("Hello World")
    expect(bound.components!.slice(1)).toEqual(BODY)
  })

  it("filters the featured image out of its parent when null", () => {
    const root: ComponentDefinition = {
      tagName: "article",
      components: [image(), title(), slot()],
    }
    const bound = bindPostTemplate(
      root,
      { ...POST, featuredImage: null },
      BODY
    )
    const types = bound.components!.map((c) => c.type ?? c.tagName)
    expect(types).toEqual([POST_FIELD_TYPES.title, POST_FIELD_TYPES.contentSlot])
  })

  it("binds the featured image src when present, preserving other attributes", () => {
    const root: ComponentDefinition = {
      tagName: "article",
      components: [image(), slot()],
    }
    const bound = bindPostTemplate(root, POST, BODY)
    const img = bound.components![0]
    expect(img.attributes).toEqual({
      class: "tc-post-featured-image",
      alt: "",
      src: "/uploads/hero.jpg",
    })
  })

  it("binds fields nested arbitrarily deep", () => {
    const root: ComponentDefinition = {
      tagName: "article",
      components: [
        {
          tagName: "header",
          components: [{ tagName: "div", components: [title()] }],
        },
        slot(),
      ],
    }
    const bound = bindPostTemplate(root, POST, BODY)
    const deepTitle = bound.components![0].components![0].components![0]
    expect(deepTitle.content).toBe("Hello World")
  })

  it("renders an empty date when the post is unpublished", () => {
    const root: ComponentDefinition = {
      tagName: "article",
      components: [date(), slot()],
    }
    const bound = bindPostTemplate(root, { ...POST, publishedAt: null }, BODY)
    expect(bound.components![0].content).toBe("")
  })

  it("does not mutate the input layout tree", () => {
    const root: ComponentDefinition = {
      tagName: "article",
      components: [title(), slot()],
    }
    const snapshot = JSON.stringify(root)
    bindPostTemplate(root, POST, BODY)
    expect(JSON.stringify(root)).toBe(snapshot)
  })
})
