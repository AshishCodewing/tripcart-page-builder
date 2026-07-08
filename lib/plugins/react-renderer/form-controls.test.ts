import { describe, expect, it } from "vitest"

import {
  booleanAttrPresent,
  selectDefaultValue,
} from "@/lib/plugins/react-renderer/form-controls"

describe("booleanAttrPresent", () => {
  it("treats true and any string (even empty) as present", () => {
    expect(booleanAttrPresent(true)).toBe(true)
    expect(booleanAttrPresent("selected")).toBe(true)
    expect(booleanAttrPresent("")).toBe(true)
  })

  it("treats false and nullish as absent", () => {
    expect(booleanAttrPresent(false)).toBe(false)
    expect(booleanAttrPresent(undefined)).toBe(false)
    expect(booleanAttrPresent(null)).toBe(false)
  })
})

describe("selectDefaultValue", () => {
  const opts = [
    { selected: false, value: "a", text: "One" },
    { selected: true, value: "b", text: "Two" },
    { selected: true, value: "c", text: "Three" },
  ]

  it("keeps the LAST selected option for a single select (HTML semantics)", () => {
    expect(selectDefaultValue(opts, false)).toBe("c")
  })

  it("keeps all selected options for a multiple select", () => {
    expect(selectDefaultValue(opts, true)).toEqual(["b", "c"])
  })

  it("falls back to the option text when there is no value attribute", () => {
    expect(
      selectDefaultValue([{ selected: true, value: undefined, text: "Two" }], false)
    ).toBe("Two")
  })

  it("preserves an explicit empty-string value (no text fallback)", () => {
    expect(
      selectDefaultValue([{ selected: true, value: "", text: "Placeholder" }], false)
    ).toBe("")
  })

  it("returns undefined when nothing is selected", () => {
    expect(
      selectDefaultValue([{ selected: false, value: "a", text: "One" }], false)
    ).toBeUndefined()
  })
})
