import { describe, expect, it } from "vitest"

import {
  RADIAL_POSITION_LABELS,
  TYPE_LABELS,
  baseTypeOf,
  clamp,
  sortStops,
  titleCase,
} from "./gradient-picker-helpers"

describe("clamp", () => {
  it("bounds a number to [min, max]", () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(99, 0, 10)).toBe(10)
  })
})

describe("sortStops", () => {
  it("orders stops by numeric position without mutating the input", () => {
    const stops = [
      { color: "blue", position: "100%" },
      { color: "red", position: "0%" },
      { color: "green", position: "50%" },
    ]
    const sorted = sortStops(stops)
    expect(sorted.map((s) => s.color)).toEqual(["red", "green", "blue"])
    expect(stops[0].color).toBe("blue") // original untouched
  })
})

describe("baseTypeOf", () => {
  it("collapses repeating variants to their base axis", () => {
    expect(baseTypeOf("linear")).toBe("linear")
    expect(baseTypeOf("repeating-linear")).toBe("linear")
    expect(baseTypeOf("radial")).toBe("radial")
    expect(baseTypeOf("repeating-radial")).toBe("radial")
  })
})

describe("titleCase / label maps", () => {
  it("title-cases each word", () => {
    expect(titleCase("top left")).toBe("Top Left")
  })

  it("labels every gradient type and radial position", () => {
    expect(TYPE_LABELS["repeating-linear"]).toBe("Repeating Linear")
    expect(RADIAL_POSITION_LABELS["bottom right"]).toBe("Bottom Right")
  })
})
