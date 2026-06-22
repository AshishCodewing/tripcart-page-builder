import { describe, expect, it } from "vitest"

import {
  coerceDirection,
  degreesToDirection,
  directionToDegrees,
  parseGradient,
  radialPositionFromDirection,
  radialPositionToDirection,
  stopPercent,
  formatPercent,
  toGradient,
} from "."

describe("parseGradient", () => {
  it("returns null for empty/invalid input", () => {
    expect(parseGradient(null)).toBeNull()
    expect(parseGradient(undefined)).toBeNull()
    expect(parseGradient("")).toBeNull()
    expect(parseGradient("not-a-gradient")).toBeNull()
    expect(parseGradient("linear-gradient(red)")).toBeNull() // < 2 parts
  })

  it("detects the four gradient types (longest prefix wins)", () => {
    expect(parseGradient("linear-gradient(red, blue)")?.type).toBe("linear")
    expect(parseGradient("radial-gradient(red, blue)")?.type).toBe("radial")
    expect(parseGradient("repeating-linear-gradient(red, blue)")?.type).toBe(
      "repeating-linear"
    )
    expect(parseGradient("repeating-radial-gradient(red, blue)")?.type).toBe(
      "repeating-radial"
    )
  })

  it("auto-fills evenly spaced positions when omitted", () => {
    expect(parseGradient("linear-gradient(red, blue)")?.stops).toEqual([
      { color: "red", position: "0%" },
      { color: "blue", position: "100%" },
    ])
    expect(parseGradient("linear-gradient(red, green, blue)")?.stops).toEqual([
      { color: "red", position: "0%" },
      { color: "green", position: "50%" },
      { color: "blue", position: "100%" },
    ])
  })

  it("keeps explicit positions and only fills the gaps", () => {
    expect(
      parseGradient("linear-gradient(red 0%, green, blue 100%)")?.stops
    ).toEqual([
      { color: "red", position: "0%" },
      { color: "green", position: "50%" },
      { color: "blue", position: "100%" },
    ])
  })

  it("does not split commas nested inside rgba()/color-mix()", () => {
    const g = parseGradient(
      "linear-gradient(90deg, rgba(0,0,0,.5) 30%, blue 100%)"
    )
    expect(g?.direction).toBe("90deg")
    expect(g?.stops).toEqual([
      { color: "rgba(0,0,0,.5)", position: "30%" },
      { color: "blue", position: "100%" },
    ])
  })

  it("extracts a leading direction for linear and radial", () => {
    expect(parseGradient("linear-gradient(45deg, red, blue)")?.direction).toBe(
      "45deg"
    )
    expect(
      parseGradient("linear-gradient(to right, red, blue)")?.direction
    ).toBe("to right")
    expect(
      parseGradient("radial-gradient(circle at top, red, blue)")?.direction
    ).toBe("circle at top")
  })

  it("defaults direction when none is present", () => {
    expect(parseGradient("linear-gradient(red, blue)")?.direction).toBe("90deg")
    expect(parseGradient("radial-gradient(red, blue)")?.direction).toBe(
      "circle at center"
    )
  })
})

describe("toGradient", () => {
  it("returns empty string with no stops", () => {
    expect(toGradient("linear", "90deg", [])).toBe("")
  })

  it("serializes stops and passes angles/prefixed directions through", () => {
    expect(
      toGradient("linear", "45deg", [
        { color: "red", position: "0%" },
        { color: "blue", position: "100%" },
      ])
    ).toBe("linear-gradient(45deg, red 0%, blue 100%)")
  })

  it("expands bare cardinal directions per type", () => {
    expect(
      toGradient("linear", "top", [
        { color: "red", position: "0%" },
        { color: "blue", position: "100%" },
      ])
    ).toBe("linear-gradient(to top, red 0%, blue 100%)")
    expect(
      toGradient("radial", "top", [
        { color: "red", position: "0%" },
        { color: "blue", position: "100%" },
      ])
    ).toBe("radial-gradient(circle at top, red 0%, blue 100%)")
    // linear "center" maps to "to right"
    expect(
      toGradient("linear", "center", [
        { color: "red", position: "0%" },
        { color: "blue", position: "" },
      ])
    ).toBe("linear-gradient(to right, red 0%, blue)")
  })

  it("round-trips with parseGradient for nested-color stops", () => {
    const css = "linear-gradient(45deg, rgba(0,0,0,.5) 30%, blue 100%)"
    const parsed = parseGradient(css)!
    expect(toGradient(parsed.type, parsed.direction, parsed.stops)).toBe(css)
  })
})

describe("directionToDegrees", () => {
  it("converts angle units", () => {
    expect(directionToDegrees("45deg")).toBe(45)
    expect(directionToDegrees("0.5turn")).toBe(180)
    expect(directionToDegrees("100grad")).toBe(90)
    expect(directionToDegrees("3.141592653589793rad")).toBeCloseTo(180, 5)
  })

  it("converts cardinal and diagonal 'to' directions", () => {
    expect(directionToDegrees("to top")).toBe(0)
    expect(directionToDegrees("to right")).toBe(90)
    expect(directionToDegrees("to bottom")).toBe(180)
    expect(directionToDegrees("to left")).toBe(270)
    expect(directionToDegrees("to right top")).toBe(45)
    expect(directionToDegrees("to bottom right")).toBe(135)
    expect(directionToDegrees("to bottom left")).toBe(225)
    expect(directionToDegrees("to left top")).toBe(315)
  })

  it("converts bare cardinal keywords", () => {
    expect(directionToDegrees("top")).toBe(0)
    expect(directionToDegrees("left")).toBe(270)
  })

  it("returns null for non-angle directions", () => {
    expect(directionToDegrees("circle at center")).toBeNull()
    expect(directionToDegrees("45px")).toBeNull()
    expect(directionToDegrees("")).toBeNull()
  })
})

describe("degreesToDirection", () => {
  it("normalizes into [0, 360) and appends deg", () => {
    expect(degreesToDirection(45)).toBe("45deg")
    expect(degreesToDirection(360)).toBe("0deg")
    expect(degreesToDirection(450)).toBe("90deg")
    expect(degreesToDirection(-45)).toBe("315deg")
  })
})

describe("coerceDirection", () => {
  it("preserves direction within the same axis-world", () => {
    expect(coerceDirection("linear", "repeating-linear", "45deg")).toBe("45deg")
    expect(coerceDirection("radial", "repeating-radial", "center")).toBe(
      "center"
    )
  })

  it("swaps to a sensible default when crossing linear/radial", () => {
    expect(coerceDirection("linear", "radial", "45deg")).toBe("center")
    expect(coerceDirection("radial", "linear", "circle at top")).toBe("90deg")
  })
})

describe("radial position helpers", () => {
  it("extracts grid positions from various direction forms", () => {
    expect(radialPositionFromDirection("circle at top left")).toBe("top left")
    expect(radialPositionFromDirection("at center")).toBe("center")
    expect(radialPositionFromDirection("top left")).toBe("top left")
    expect(radialPositionFromDirection("left top")).toBe("top left") // reordered
    expect(radialPositionFromDirection("right")).toBe("right")
  })

  it("falls back to center for unrecognized input", () => {
    expect(radialPositionFromDirection("top-left")).toBe("center")
    expect(radialPositionFromDirection("foo bar")).toBe("center")
  })

  it("round-trips through radialPositionToDirection", () => {
    expect(radialPositionToDirection("top left")).toBe("circle at top left")
    expect(
      radialPositionFromDirection(radialPositionToDirection("bottom right"))
    ).toBe("bottom right")
  })
})

describe("stopPercent / formatPercent", () => {
  it("parses and clamps percentages", () => {
    expect(stopPercent("50%")).toBe(50)
    expect(stopPercent("150%")).toBe(100)
    expect(stopPercent("-50%")).toBe(0)
    expect(stopPercent("10px")).toBe(10) // parseFloat reads the number
    expect(stopPercent("nope")).toBe(0)
  })

  it("formats with one decimal of precision", () => {
    expect(formatPercent(50)).toBe("50%")
    expect(formatPercent(33.333)).toBe("33.3%")
    expect(formatPercent(50.04)).toBe("50%")
  })
})
