import { afterEach, describe, expect, it, vi } from "vitest"

import {
  camelKeysToKebabStyle,
  camelToKebab,
  kebabToCamel,
  normalizeStyleObject,
} from "@/lib/plugins/react-renderer/style"

describe("camelToKebab", () => {
  it("hyphenates an interior capital", () => {
    expect(camelToKebab("backgroundColor")).toBe("background-color")
  })

  it("lowercases a leading capital run without a leading hyphen", () => {
    expect(camelToKebab("WebkitTransform")).toBe("webkit-transform")
  })
})

describe("kebabToCamel", () => {
  it("camelizes a hyphenated name", () => {
    expect(kebabToCamel("font-size")).toBe("fontSize")
  })

  it("passes a name with no hyphen through unchanged", () => {
    expect(kebabToCamel("color")).toBe("color")
  })
})

describe("camelKeysToKebabStyle", () => {
  it("kebab-cases keys and preserves string/number values", () => {
    expect(
      camelKeysToKebabStyle({ backgroundColor: "red", zIndex: 2 })
    ).toEqual({ "background-color": "red", "z-index": 2 })
  })
})

describe("normalizeStyleObject — object input", () => {
  it("camelizes kebab keys", () => {
    expect(normalizeStyleObject({ "font-size": "10px" })).toEqual({
      fontSize: "10px",
    })
  })

  it("drops non-string/number values", () => {
    expect(normalizeStyleObject({ "font-size": "10px", margin: {} })).toEqual({
      fontSize: "10px",
    })
  })

  it("returns undefined when every value is dropped", () => {
    expect(normalizeStyleObject({ margin: {} })).toBeUndefined()
  })
})

describe("normalizeStyleObject — string input", () => {
  it("parses a declaration list", () => {
    expect(normalizeStyleObject("color:red;font-size:12px")).toEqual({
      color: "red",
      fontSize: "12px",
    })
  })

  it("skips empty/whitespace declarations", () => {
    expect(normalizeStyleObject("color:red;;  ;font-size:12px")).toEqual({
      color: "red",
      fontSize: "12px",
    })
  })

  it("returns undefined silently for a non-declaration, non-JSON string", () => {
    // A bare word like "red" matches neither a declaration list (no colon) nor
    // a JSON object (no leading `{`), so it returns undefined without logging.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(normalizeStyleObject("red")).toBeUndefined()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it("JSON-decodes a JSON-encoded style object", () => {
    // A string starting with `{` is parsed as JSON first, so a stored style
    // attribute round-trips into a camelCased React style object.
    expect(normalizeStyleObject('{"font-size":"10px"}')).toEqual({
      fontSize: "10px",
    })
  })

  it("returns undefined for an empty JSON object string (by design)", () => {
    // '{}' parses as JSON, but kebabKeysToCamelStyle({}) finds no keys, so the
    // all-dropped rule yields undefined.
    expect(normalizeStyleObject("{}")).toBeUndefined()
  })
})

describe("normalizeStyleObject — array input", () => {
  it("reads name/property + value pairs, skipping invalid entries", () => {
    const input = [
      { name: "color", value: "red" },
      { property: "font-size", value: 10 },
      { name: "", value: "x" }, // empty name → skipped
      { name: "margin", value: undefined }, // undefined value → skipped
      { name: "padding", value: "" }, // empty value → skipped
      { name: "z-index", value: {} }, // non-string/number → skipped
    ]
    expect(normalizeStyleObject(input)).toEqual({ color: "red", fontSize: 10 })
  })
})

describe("normalizeStyleObject — falsy input", () => {
  it.each([[null], [""], [undefined]])("returns undefined for %p", (value) => {
    expect(normalizeStyleObject(value)).toBeUndefined()
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})
