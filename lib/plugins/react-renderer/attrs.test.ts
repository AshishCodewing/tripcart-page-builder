import { describe, expect, it } from "vitest"

import { attrsToReactProps } from "@/lib/plugins/react-renderer/attrs"

describe("attrsToReactProps", () => {
  it("maps class → className and for → htmlFor", () => {
    expect(attrsToReactProps({ class: "a b", for: "x" })).toEqual({
      className: "a b",
      htmlFor: "x",
    })
  })

  it("drops false on a non-boolean attribute but keeps it on a boolean one", () => {
    expect(attrsToReactProps({ target: false })).toEqual({})
    expect(attrsToReactProps({ disabled: false })).toEqual({ disabled: false })
  })

  it("parses a style string into an object", () => {
    expect(attrsToReactProps({ style: "color:red" })).toEqual({
      style: { color: "red" },
    })
  })

  it("passes data-* attributes through with their original key", () => {
    expect(attrsToReactProps({ "data-foo": "1" })).toEqual({ "data-foo": "1" })
  })

  it("applies ATTR_CASE_MAP entries (stroke-width, tabindex)", () => {
    expect(attrsToReactProps({ "stroke-width": "2", tabindex: "0" })).toEqual({
      strokeWidth: "2",
      tabIndex: "0",
    })
  })

  it("camelizes the whole bag once viewBox flips on SVG context", () => {
    expect(
      attrsToReactProps({ viewBox: "0 0 10 10", "clip-path": "url(#c)" })
    ).toEqual({ viewBox: "0 0 10 10", clipPath: "url(#c)" })
  })

  it("treats a `d` attribute as SVG and camelizes per-prop SVG names without context", () => {
    expect(attrsToReactProps({ d: "M0 0" })).toEqual({ d: "M0 0" })
    expect(attrsToReactProps({ cx: "5" })).toEqual({ cx: "5" })
  })

  it("(KNOWN QUIRK) leaves aria-label as its original key", () => {
    // KNOWN QUIRK: kebabToCamel("aria-label") → "ariaLabel", which has no
    // hyphen, so the `camel.startsWith("aria-")` guard can never fire — the
    // attribute falls through to the unknown-attribute branch and keeps its
    // original kebab key. Audited 2026-06-11.
    expect(attrsToReactProps({ "aria-label": "hi" })).toEqual({
      "aria-label": "hi",
    })
  })

  it("keeps an unknown attribute's original key", () => {
    expect(attrsToReactProps({ "my-attr": "v" })).toEqual({ "my-attr": "v" })
  })

  it("passes standard React props through unchanged", () => {
    expect(attrsToReactProps({ href: "/x", id: "y" })).toEqual({
      href: "/x",
      id: "y",
    })
  })
})
