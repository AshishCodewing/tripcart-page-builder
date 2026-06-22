// Serialize a structured gradient back into a CSS string.

import { isLinearType, type GradientStop, type GradientType } from "./types"

// Convert a named cardinal direction into the appropriate CSS phrasing for
// the gradient type. Angles and already-prefixed strings pass through.
const expandDirection = (type: GradientType, direction: string): string => {
  const dir = direction.trim()

  if (isLinearType(type)) {
    if (/^to\s/i.test(dir)) return dir
    if (/-?\d+(\.\d+)?(deg|rad|grad|turn)$/i.test(dir)) return dir
    if (dir === "center") return "to right"
    if (["top", "right", "bottom", "left"].includes(dir)) return `to ${dir}`
    return dir
  }

  // radial / repeating-radial
  if (/\bat\b/i.test(dir)) return dir
  if (/^(circle|ellipse)\b/i.test(dir)) return dir
  if (["top", "right", "bottom", "left", "center"].includes(dir)) {
    return `circle at ${dir}`
  }
  return dir
}

export function toGradient(
  type: GradientType,
  direction: string,
  stops: GradientStop[]
): string {
  if (!stops.length) return ""
  const dir = expandDirection(type, direction)
  const stopsCss = stops
    .map((s) => (s.position ? `${s.color} ${s.position}` : s.color))
    .join(", ")
  return `${type}-gradient(${dir}, ${stopsCss})`
}
