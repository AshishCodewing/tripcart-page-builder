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

  it("maps hyphen-less HTML attributes React expects camelCased (datetime, hreflang, cellpadding)", () => {
    expect(
      attrsToReactProps({
        datetime: "2026-07-16",
        hreflang: "en",
        cellpadding: "0",
      })
    ).toEqual({
      dateTime: "2026-07-16",
      hrefLang: "en",
      cellPadding: "0",
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

  it("passes aria-* through with its original kebab key", () => {
    // The aria-* branch tests the original key (not the camelized one) and
    // leaves kebab aria-* props untouched — React accepts them verbatim.
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
