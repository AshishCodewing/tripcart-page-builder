import { describe, expect, it } from "vitest"

import { getAtPath, isEqualJson, setAtPath } from "@/lib/theme/style-paths"

const fixture = () => ({
  keep: { untouched: true },
  styles: { elements: { button: { color: { text: "red" } } } },
})

describe("isEqualJson", () => {
  it("compares by structure, ignoring key order and identity", () => {
    expect(
      isEqualJson({ a: 1, b: [1, { c: "x" }] }, { b: [1, { c: "x" }], a: 1 })
    ).toBe(true)
    expect(isEqualJson({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(isEqualJson([1, 2], [2, 1])).toBe(false)
    expect(isEqualJson(undefined, undefined)).toBe(true)
    expect(isEqualJson({}, undefined)).toBe(false)
  })
})

describe("getAtPath", () => {
  it("walks nested objects and returns undefined for a missing branch", () => {
    const obj = fixture()
    expect(
      getAtPath(obj, ["styles", "elements", "button", "color", "text"])
    ).toBe("red")
    expect(getAtPath(obj, ["styles", "components", "tc-tabs"])).toBeUndefined()
    expect(getAtPath(obj, ["keep", "untouched", "deeper"])).toBeUndefined()
  })
})

describe("setAtPath", () => {
  it("creates missing intermediates in one write", () => {
    const out = setAtPath({} as Record<string, unknown>, ["a", "b", "c"], "1")
    expect(out).toEqual({ a: { b: { c: "1" } } })
  })

  it("shares references for untouched subtrees", () => {
    const obj = fixture()
    const out = setAtPath(
      obj,
      ["styles", "elements", "button", "color", "text"],
      "blue"
    )!
    expect(out).not.toBe(obj)
    expect(out.keep).toBe(obj.keep)
    expect(
      getAtPath(out, ["styles", "elements", "button", "color", "text"])
    ).toBe("blue")
  })

  it("returns the same object when the value is unchanged", () => {
    const obj = fixture()
    expect(
      setAtPath(obj, ["styles", "elements", "button", "color", "text"], "red")
    ).toBe(obj)
    expect(setAtPath(obj, ["styles", "components", "gone"], undefined)).toBe(
      obj
    )
  })

  it("deletes a leaf and prunes every ancestor it empties", () => {
    const obj = fixture()
    const out = setAtPath(
      obj,
      ["styles", "elements", "button", "color", "text"],
      undefined
    )!
    expect(out.keep).toBe(obj.keep)
    expect(out.styles).toBeUndefined()
  })

  it("stops pruning at the first ancestor that still has siblings", () => {
    const obj = {
      styles: {
        elements: {
          button: { color: { text: "red" }, border: { radius: "4px" } },
        },
      },
    }
    const out = setAtPath(
      obj,
      ["styles", "elements", "button", "color", "text"],
      undefined
    )!
    expect(out.styles.elements.button).toEqual({ border: { radius: "4px" } })
  })

  it("returns undefined when the whole object empties out", () => {
    expect(setAtPath({ a: { b: "1" } }, ["a", "b"], undefined)).toBeUndefined()
  })
})
