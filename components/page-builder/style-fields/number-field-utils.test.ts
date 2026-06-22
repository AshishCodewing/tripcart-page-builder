import { describe, expect, it } from "vitest"

import {
  displayUnit,
  numericPart,
  parseValueShape,
  resolveNumberCommit,
} from "./number-field-utils"

describe("parseValueShape", () => {
  it("classifies empty, numeric (with/without unit), and fixed values", () => {
    expect(parseValueShape("  ")).toEqual({ kind: "empty" })
    expect(parseValueShape("16")).toEqual({
      kind: "numeric",
      number: "16",
      unit: "",
    })
    expect(parseValueShape("-1.5rem")).toEqual({
      kind: "numeric",
      number: "-1.5",
      unit: "rem",
    })
    expect(parseValueShape(".5")).toEqual({
      kind: "numeric",
      number: ".5",
      unit: "",
    })
    expect(parseValueShape("var(--x)")).toEqual({
      kind: "fixed",
      value: "var(--x)",
    })
  })
})

describe("displayUnit / numericPart", () => {
  it("renders empty unit as em dash", () => {
    expect(displayUnit("")).toBe("—")
    expect(displayUnit("px")).toBe("px")
  })

  it("strips the unit from a composed value", () => {
    expect(numericPart("279deg")).toBe("279")
    expect(numericPart("auto")).toBe("")
  })
})

describe("resolveNumberCommit", () => {
  it("clears on empty", () => {
    expect(resolveNumberCommit("", ["px"], "px")).toEqual({ action: "clear" })
  })

  it("passes fixed-values through without reformat", () => {
    expect(resolveNumberCommit("var(--x)", ["px"], "px")).toEqual({
      action: "commit",
      value: "var(--x)",
      reformat: false,
    })
  })

  it("keeps an explicit unit and reformats", () => {
    expect(resolveNumberCommit("12rem", ["px", "rem"], "px")).toEqual({
      action: "commit",
      value: "12rem",
      reformat: true,
    })
  })

  it("composes a bare number with the current unit", () => {
    expect(resolveNumberCommit("12", ["px", "rem"], "rem")).toEqual({
      action: "commit",
      value: "12rem",
      reformat: true,
    })
  })

  it("falls back to the first unit when none is active", () => {
    expect(resolveNumberCommit("12", ["px", "rem"], "")).toEqual({
      action: "commit",
      value: "12px",
      reformat: true,
    })
  })

  it("commits a bare number when the unit list is unitless", () => {
    // line-height: units = [""] → useUnit "" → bare number.
    expect(resolveNumberCommit("1.5", [""], "")).toEqual({
      action: "commit",
      value: "1.5",
      reformat: true,
    })
  })

  it("commits a bare number when there are no units at all", () => {
    expect(resolveNumberCommit("3", [], "")).toEqual({
      action: "commit",
      value: "3",
      reformat: false,
    })
  })
})
