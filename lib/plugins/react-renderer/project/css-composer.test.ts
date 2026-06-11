import { describe, expect, it } from "vitest"

import { CssComposer } from "@/lib/plugins/react-renderer/project/css-composer"
import type { Rule } from "@/lib/plugins/react-renderer/project/types"

const css = (rules: unknown[]) =>
  new CssComposer(rules as Rule[]).getCssAsString()

describe("CssComposer.getCssAsString", () => {
  it("stringifies a plain rule", () => {
    expect(css([{ selectors: ["a"], style: { color: "red" } }])).toBe(
      ".a{color:red;}"
    )
  })

  it("joins multiple selectors with no separator (compound)", () => {
    expect(css([{ selectors: ["a", "b"], style: { color: "red" } }])).toBe(
      ".a.b{color:red;}"
    )
  })

  it("handles object, #id, and .class selector shapes", () => {
    expect(
      css([
        { selectors: [{ name: "x" }, "#id", ".y"], style: { color: "red" } },
      ])
    ).toBe(".x#id.y{color:red;}")
  })

  it("appends a pseudo state", () => {
    expect(
      css([{ selectors: ["a"], state: "hover", style: { color: "red" } }])
    ).toBe(".a:hover{color:red;}")
  })

  it("appends selectorsAdd after a comma", () => {
    expect(
      css([
        {
          selectors: ["a"],
          selectorsAdd: "#raw > .child",
          style: { color: "red" },
        },
      ])
    ).toBe(".a, #raw > .child{color:red;}")
  })

  it("adds !important to every declaration when important is true", () => {
    expect(
      css([
        {
          selectors: ["a"],
          style: { color: "red", margin: "0" },
          important: true,
        },
      ])
    ).toBe(".a{color:red !important;margin:0 !important;}")
  })

  it("adds !important to only the listed property", () => {
    expect(
      css([
        {
          selectors: ["a"],
          style: { color: "red", margin: "0" },
          important: ["color"],
        },
      ])
    ).toBe(".a{color:red !important;margin:0;}")
  })

  it("skips __-prefixed style keys", () => {
    expect(
      css([{ selectors: ["a"], style: { __temp: "x", color: "red" } }])
    ).toBe(".a{color:red;}")
  })

  it("emits one declaration per value for an array style value", () => {
    expect(css([{ selectors: ["a"], style: { color: ["red", "blue"] } }])).toBe(
      ".a{color:red;color:blue;}"
    )
  })

  it("sorts min-width media queries ascending (480 before 768)", () => {
    const out = css([
      {
        selectors: ["a"],
        mediaText: "(min-width: 768px)",
        style: { color: "blue" },
      },
      {
        selectors: ["a"],
        mediaText: "(min-width: 480px)",
        style: { color: "red" },
      },
    ])
    expect(out).toContain("@media (min-width: 480px)")
    expect(out).toContain("@media (min-width: 768px)")
    expect(out.indexOf("480px")).toBeLessThan(out.indexOf("768px"))
  })

  it("sorts max-width media queries descending (991 before 479)", () => {
    const out = css([
      {
        selectors: ["a"],
        mediaText: "(max-width: 479px)",
        style: { color: "red" },
      },
      {
        selectors: ["a"],
        mediaText: "(max-width: 991px)",
        style: { color: "blue" },
      },
    ])
    expect(out.indexOf("991px")).toBeLessThan(out.indexOf("479px"))
  })

  it("emits a single at-rule (@font-face) with bare declarations", () => {
    expect(
      css([
        {
          atRuleType: "font-face",
          singleAtRule: true,
          style: { "font-family": "X", src: "url(x)" },
        },
      ])
    ).toBe("@font-face{font-family:X;src:url(x);}")
  })

  it("returns an empty string for no rules", () => {
    expect(css([])).toBe("")
  })
})
