// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import {
  INLINE_FRAGMENT_ATTR,
  inlineSchema,
  parseInlineElement,
  serializeInlineDoc,
} from "./schema"

const leaf = (html: string) => {
  const a = document.createElement("a")
  a.innerHTML = html
  return a
}

/** Round-trip a leaf's inner HTML through the inline (fragment) schema. */
const roundTrip = (html: string) =>
  serializeInlineDoc(parseInlineElement(leaf(html)))

describe("inline fragment schema", () => {
  it("wraps bare inline content in a single inlineFragment on parse", () => {
    const doc = parseInlineElement(leaf("Hello"))
    expect(doc.childCount).toBe(1)
    expect(doc.child(0).type).toBe(inlineSchema.nodes.inlineFragment)
    expect(doc.child(0).textContent).toBe("Hello")
  })

  it("strips the data-gs-ifrg wrapper on serialize", () => {
    const out = roundTrip("Hello world")
    expect(out).toBe("Hello world")
    expect(out).not.toContain(INLINE_FRAGMENT_ATTR)
  })

  it("preserves inline marks without leaking the wrapper", () => {
    const out = roundTrip("<strong>bold</strong> and <em>italic</em>")
    expect(out).toContain("<strong>bold</strong>")
    expect(out).toContain("<em>italic</em>")
    expect(out).not.toContain(INLINE_FRAGMENT_ATTR)
  })

  it("round-trips an authored link without nesting or the wrapper", () => {
    const out = roundTrip('<a href="https://x.com">go</a>')
    expect(out).toContain('href="https://x.com"')
    // The link mark serializes back to a single <a>, inside no wrapper span.
    expect(out).not.toContain(INLINE_FRAGMENT_ATTR)
    expect(out.match(/<a\b/g)?.length).toBe(1)
  })

  it("handles empty leaf content", () => {
    const doc = parseInlineElement(leaf(""))
    expect(doc.childCount).toBe(1)
    expect(doc.child(0).type).toBe(inlineSchema.nodes.inlineFragment)
    expect(serializeInlineDoc(doc)).not.toContain(INLINE_FRAGMENT_ATTR)
  })
})
