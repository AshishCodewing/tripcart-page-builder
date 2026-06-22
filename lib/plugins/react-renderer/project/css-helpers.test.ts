import { describe, expect, it } from "vitest"

import type { Rule } from "./types"
import {
  coerceSelectorName,
  getAtRule,
  getFromSelectorName,
  selectorsToString,
  sortMediaObject,
  styleToString,
} from "./css-helpers"

describe("coerceSelectorName", () => {
  it("reads strings and { name }/{ label } objects", () => {
    expect(coerceSelectorName("foo")).toBe("foo")
    expect(coerceSelectorName({ name: "bar" })).toBe("bar")
    expect(coerceSelectorName({ label: "baz" })).toBe("baz")
    expect(coerceSelectorName(42)).toBe("")
  })
})

describe("getFromSelectorName", () => {
  it("preserves #id/.class and prefixes bare names with a dot", () => {
    expect(getFromSelectorName("#main")).toBe("#main")
    expect(getFromSelectorName(".btn")).toBe(".btn")
    expect(getFromSelectorName("btn")).toBe(".btn")
    expect(getFromSelectorName("")).toBe("")
  })
})

describe("selectorsToString", () => {
  it("joins selectors, appends state, and adds selectorsAdd", () => {
    const rule = {
      selectors: ["btn", { name: "lg" }],
      state: "hover",
      selectorsAdd: "a:focus",
    } as unknown as Rule
    expect(selectorsToString(rule)).toBe(".btn.lg:hover, a:focus")
  })

  it("honors skipState/skipAdd", () => {
    const rule = {
      selectors: ["btn"],
      state: "hover",
      selectorsAdd: "x",
    } as unknown as Rule
    expect(selectorsToString(rule, { skipState: true, skipAdd: true })).toBe(
      ".btn"
    )
  })
})

describe("getAtRule", () => {
  it("builds @media and custom at-rule heads", () => {
    expect(getAtRule({ mediaText: "(min-width: 480px)" } as Rule)).toBe(
      "@media (min-width: 480px)"
    )
    expect(getAtRule({ atRuleType: "supports" } as Rule)).toBe("@supports")
    expect(getAtRule({} as Rule)).toBe("")
  })
})

describe("styleToString", () => {
  it("emits declarations, skips __-internal props, applies !important", () => {
    const rule = {
      style: { color: "red", __locked: "x", margin: "0" },
      important: ["color"],
    } as unknown as Rule
    expect(styleToString(rule)).toBe("color:red !important;margin:0;")
  })

  it("expands array values into repeated declarations", () => {
    const rule = {
      style: { background: ["url(a)", "url(b)"] },
    } as unknown as Rule
    expect(styleToString(rule)).toBe("background:url(a);background:url(b);")
  })
})

describe("sortMediaObject", () => {
  it("orders min-width queries ascending", () => {
    const out = sortMediaObject({
      "@media (min-width: 768px)": [],
      "@media (min-width: 480px)": [],
    })
    expect(out.map((o) => o.key)).toEqual([
      "@media (min-width: 480px)",
      "@media (min-width: 768px)",
    ])
  })
})
