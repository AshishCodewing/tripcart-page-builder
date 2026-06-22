// Direction ↔ angle conversions for the linear-gradient numeric input.

import { isLinearType, type GradientType } from "./types"

// Cardinal side → degrees. CSS maps "to top" → 0deg, then clockwise.
const SIDE_TO_DEG: Record<string, number> = {
  top: 0,
  right: 90,
  bottom: 180,
  left: 270,
}

// Diagonal corner (sorted token pair) → degrees.
const CORNER_TO_DEG: Record<string, number> = {
  "right-top": 45,
  "bottom-right": 135,
  "bottom-left": 225,
  "left-top": 315,
}

// Angle unit → multiplier to degrees.
const ANGLE_UNIT_TO_DEG: Record<string, number> = {
  deg: 1,
  rad: 180 / Math.PI,
  grad: 9 / 10,
  turn: 360,
}

// Map a direction string between the linear/radial worlds when the gradient
// type changes. Angles aren't meaningful for radial gradients, and the
// `circle at <dir>` syntax isn't valid for linear ones.
export function coerceDirection(
  fromType: GradientType,
  toType: GradientType,
  direction: string
): string {
  const fromLinear = isLinearType(fromType)
  const toLinear = isLinearType(toType)
  if (fromLinear === toLinear) return direction
  return toLinear ? "90deg" : "center"
}

// Convert "to right" / "to bottom" / "45deg" → degrees for the numeric input.
// Returns null when the direction isn't an angle-compatible expression
// (radial named positions, "circle at center", etc.).
export function directionToDegrees(direction: string): number | null {
  const dir = direction.trim()

  const angleMatch = dir.match(/^(-?\d+(?:\.\d+)?)(deg|rad|grad|turn)$/i)
  if (angleMatch) {
    const n = parseFloat(angleMatch[1])
    return n * ANGLE_UNIT_TO_DEG[angleMatch[2].toLowerCase()]
  }

  const toMatch = dir.match(
    /^to\s+(top|right|bottom|left)(?:\s+(top|right|bottom|left))?$/i
  )
  if (toMatch) {
    const a = toMatch[1].toLowerCase()
    const b = toMatch[2]?.toLowerCase()
    if (!b) return SIDE_TO_DEG[a] ?? null
    // Diagonal corners.
    const pair = [a, b].sort().join("-")
    return CORNER_TO_DEG[pair] ?? null
  }

  return SIDE_TO_DEG[dir] ?? null
}

export function degreesToDirection(deg: number): string {
  // Normalize to [0, 360).
  const norm = ((deg % 360) + 360) % 360
  return `${Math.round(norm * 100) / 100}deg`
}
