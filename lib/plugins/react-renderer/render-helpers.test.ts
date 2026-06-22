import { describe, expect, it } from "vitest"

import { mergeRenderChildren, resolveComponentTag } from "./render-helpers"

const Comp = () => null

describe("resolveComponentTag", () => {
  it("prefers a registered component, then tagName prop, then persisted tag", () => {
    expect(resolveComponentTag(Comp, "span", "div")).toBe(Comp)
    expect(resolveComponentTag(undefined, "span", "div")).toBe("span")
    expect(resolveComponentTag(undefined, undefined, "section")).toBe("section")
  })

  it("falls back to div", () => {
    expect(resolveComponentTag(undefined, undefined, undefined)).toBe("div")
    expect(resolveComponentTag(undefined, undefined, "")).toBe("div")
  })
})

describe("mergeRenderChildren", () => {
  it("drops nullish entries and keeps the rest", () => {
    expect(mergeRenderChildren(["a", undefined, null, "b"], "c")).toEqual([
      "a",
      "b",
      "c",
    ])
  })

  it("returns null when nothing survives", () => {
    expect(mergeRenderChildren([undefined, null], undefined)).toBeNull()
  })

  it("drops falsy nodes (0, '') — the filter uses the node as its own predicate", () => {
    // `(n) => n ?? false` keeps the node only when it's a truthy predicate, so
    // 0 and "" are dropped. Preserved verbatim from the original render path.
    expect(mergeRenderChildren([0, ""], undefined)).toBeNull()
  })
})
