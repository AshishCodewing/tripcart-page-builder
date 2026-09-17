import { describe, expect, it } from "vitest"

import {
  cleanStyle,
  diffStyle,
  formatRuleCss,
  parseRuleStyle,
} from "./rule-css"

describe("formatRuleCss", () => {
  it("renders a plain rule", () => {
    expect(
      formatRuleCss({
        selector: ".box:hover",
        style: { color: "red", "--stagger-index": "1" },
      })
    ).toBe(".box:hover {\n  color: red;\n  --stagger-index: 1;\n}\n")
  })

  it("renders an empty rule", () => {
    expect(formatRuleCss({ selector: "#abc", style: {} })).toBe("#abc {\n}\n")
  })

  it("nests the rule inside its at-rule", () => {
    expect(
      formatRuleCss({
        selector: ".box",
        atRule: "@media (max-width: 992px)",
        style: { color: "red" },
      })
    ).toBe("@media (max-width: 992px) {\n  .box {\n    color: red;\n  }\n}\n")
  })
})

describe("parseRuleStyle", () => {
  const throwing = () => {
    throw new Error("CssSyntaxError")
  }

  it("returns the first rule's declarations", () => {
    const parse = () => [{ style: { color: "red", __p: true } }]
    expect(parseRuleStyle(".a { color: red }", parse)).toEqual({
      color: "red",
    })
  })

  it("returns null when the parser throws", () => {
    expect(parseRuleStyle(".a { color: ", throwing)).toBeNull()
  })

  it("treats a well-formed empty rule as an empty style", () => {
    expect(parseRuleStyle(".a {\n}\n", () => [])).toEqual({})
    expect(
      parseRuleStyle("@media (x) {\n  .a {\n  }\n}\n", () => [{ style: {} }])
    ).toEqual({})
  })

  it("rejects text that isn't a rule", () => {
    expect(parseRuleStyle("color: red", () => [])).toBeNull()
  })
})

describe("diffStyle", () => {
  it("adds, changes and removes properties", () => {
    expect(
      diffStyle(
        { color: "red", padding: "1px", margin: "0" },
        { color: "blue", margin: "0", gap: "2px" }
      )
    ).toEqual({ color: "blue", padding: "", gap: "2px" })
  })

  it("is empty when nothing changed", () => {
    expect(diffStyle({ color: "red" }, { color: "red" })).toEqual({})
  })
})

describe("cleanStyle", () => {
  it("drops internal keys and empty values", () => {
    expect(cleanStyle({ __p: true, color: "red", width: "" })).toEqual({
      color: "red",
    })
  })
})
