// Parse a CSS gradient string into a structured ParsedGradient.

import type { GradientStop, GradientType, ParsedGradient } from "./types"

// Longer matches first so "repeating-linear-gradient(" wins over "linear-gradient(".
const TYPE_PREFIXES: readonly { type: GradientType; prefix: string }[] = [
  { type: "repeating-linear", prefix: "repeating-linear-gradient(" },
  { type: "repeating-radial", prefix: "repeating-radial-gradient(" },
  { type: "linear", prefix: "linear-gradient(" },
  { type: "radial", prefix: "radial-gradient(" },
]

// Split a gradient's inside-the-parens content on commas — but ignore commas
// nested inside parens like rgba(...) or color-mix(...).
const splitTopLevelCommas = (input: string): string[] => {
  return input.split(/,(?![^(]*\))/).map((s) => s.trim())
}

// "linear-gradient(90deg, red 0%, blue 100%)" → "90deg, red 0%, blue 100%"
const innerContent = (css: string): string | null => {
  const open = css.indexOf("(")
  const close = css.lastIndexOf(")")
  if (open < 0 || close <= open) return null
  return css.substring(open + 1, close).trim()
}

const detectType = (css: string): GradientType | null => {
  const trimmed = css.trimStart()
  for (const { type, prefix } of TYPE_PREFIXES) {
    if (trimmed.startsWith(prefix)) return type
  }
  return null
}

// A token like "red 50%", "rgba(0,0,0,.5) 30%", or "blue" (position-less).
// We split off the trailing position by finding the last whitespace that's
// not inside parens.
const splitStopToken = (token: string): { color: string; position: string } => {
  // Walk right-to-left, skipping parens, to find the first space that
  // separates color from position.
  let depth = 0
  for (let i = token.length - 1; i >= 0; i--) {
    const ch = token[i]
    if (ch === ")") depth++
    else if (ch === "(") depth--
    else if (depth === 0 && /\s/.test(ch)) {
      const color = token.slice(0, i).trim()
      const position = token.slice(i + 1).trim()
      // Only treat trailing token as a position when it looks like one;
      // otherwise it's part of the color value (e.g. "currentcolor").
      if (/%$/.test(position) || /(px|em|rem)$/.test(position)) {
        return { color, position }
      }
      return { color: token.trim(), position: "" }
    }
  }
  return { color: token.trim(), position: "" }
}

// Distribute missing positions evenly between the explicit ones at the ends:
//   [red, blue]                  → 0%, 100%
//   [red, green, blue]           → 0%, 50%, 100%
//   [red 0%, green, blue 100%]   → 0%, 50%, 100%
const fillPositions = (stops: GradientStop[]): GradientStop[] => {
  if (stops.length === 0) return stops
  if (stops.length === 1)
    return [{ ...stops[0], position: stops[0].position || "0%" }]
  return stops.map((s, i) => {
    if (s.position) return s
    const pct = (i / (stops.length - 1)) * 100
    return { ...s, position: `${Math.round(pct * 100) / 100}%` }
  })
}

// Heuristic: does this token look like a direction rather than a color stop?
// `partCount` is the total number of comma-separated parts; bare cardinal
// keywords only read as a direction when there are more parts after them.
const looksLikeDirection = (token: string, partCount: number): boolean => {
  return (
    /^(to\s|from\s|at\s|circle\b|ellipse\b|closest-|farthest-)/i.test(token) ||
    /-?\d+(\.\d+)?(deg|rad|grad|turn)$/i.test(token) ||
    (["top", "right", "bottom", "left", "center"].includes(
      token.toLowerCase()
    ) &&
      partCount > 2)
  )
}

export function parseGradient(
  css: string | null | undefined
): ParsedGradient | null {
  if (!css) return null
  const value = String(css).trim()
  if (!value) return null

  const type = detectType(value)
  if (!type) return null

  const content = innerContent(value)
  if (content === null) return null

  const parts = splitTopLevelCommas(content)
  if (parts.length < 2) return null

  let direction =
    type === "linear" || type === "repeating-linear"
      ? "90deg"
      : "circle at center"

  let stopTokens = parts
  if (parts.length > 0 && looksLikeDirection(parts[0], parts.length)) {
    direction = parts[0]
    stopTokens = parts.slice(1)
  }

  const stops = fillPositions(stopTokens.map(splitStopToken))
  if (stops.length < 1) return null

  return { type, direction, stops }
}
