import { describe, expect, it } from "vitest"

import { normalizeClasses, resolveTagName } from "./component-mapper"

describe("resolveTagName", () => {
  it("maps known component types to canonical tags", () => {
    expect(resolveTagName("svg", undefined)).toBe("svg")
    expect(resolveTagName("image", undefined)).toBe("img")
    expect(resolveTagName("linkBox", undefined)).toBe("a")
    expect(resolveTagName("link", undefined)).toBe("a")
    expect(resolveTagName("head", undefined)).toBe("head")
    expect(resolveTagName("wrapper", undefined)).toBe("body")
  })

  it("falls back to the persisted tagName, then empty string", () => {
    expect(resolveTagName("default", "section")).toBe("section")
    expect(resolveTagName("default", undefined)).toBe("")
  })
})

describe("normalizeClasses", () => {
  it("flattens string and { name } entries", () => {
    expect(normalizeClasses(["a", { name: "b" }, "c"])).toEqual(["a", "b", "c"])
  })

  it("returns [] for undefined", () => {
    expect(normalizeClasses(undefined)).toEqual([])
  })
})
