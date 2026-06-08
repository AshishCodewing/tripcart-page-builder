// Pure helpers for parsing and serializing CSS gradient values, ported from
// the grapesjs-style-gradient plugin so we can drive a fully-React Style
// Manager field without taking the Grapick imperative widget along for the
// ride.

export type GradientType =
  | "linear"
  | "radial"
  | "repeating-linear"
  | "repeating-radial"

export type GradientStop = {
  color: string
  // Percentage string like "50%". Kept as a string (not a number) so we can
  // round-trip exotic values (e.g. CSS length-percentage from the wild) and
  // preserve user-entered precision.
  position: string
}

export type ParsedGradient = {
  type: GradientType
  direction: string
  stops: GradientStop[]
}

export const GRADIENT_TYPES: readonly GradientType[] = [
  "linear",
  "radial",
  "repeating-linear",
  "repeating-radial",
] as const

export const RADIAL_NAMED_DIRS = [
  "center",
  "top",
  "right",
  "bottom",
  "left",
] as const

export type RadialNamedDir = (typeof RADIAL_NAMED_DIRS)[number]

// The 3x3 grid of CSS-named radial positions. Order matters: it's the order
// the dropdown renders in (left-to-right, top-to-bottom).
export const RADIAL_POSITIONS = [
  "top left",
  "top",
  "top right",
  "left",
  "center",
  "right",
  "bottom left",
  "bottom",
  "bottom right",
] as const

export type RadialPosition = (typeof RADIAL_POSITIONS)[number]

const RADIAL_POSITION_SET = new Set<string>(RADIAL_POSITIONS)
const RADIAL_AXES = new Set(["top", "bottom", "left", "right", "center"])

export const DEFAULT_GRADIENT: ParsedGradient = {
  type: "linear",
  direction: "90deg",
  stops: [
    { color: "#000000", position: "0%" },
    { color: "#ffffff", position: "100%" },
  ],
}

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

  // Heuristic: if the first part doesn't look like "<color> <position?>", it's
  // the direction. Look for direction keywords and `<angle>` units.
  const looksLikeDirection = (token: string): boolean => {
    return (
      /^(to\s|from\s|at\s|circle\b|ellipse\b|closest-|farthest-)/i.test(
        token
      ) ||
      /-?\d+(\.\d+)?(deg|rad|grad|turn)$/i.test(token) ||
      (["top", "right", "bottom", "left", "center"].includes(
        token.toLowerCase()
      ) &&
        parts.length > 2)
    )
  }

  let direction =
    type === "linear" || type === "repeating-linear"
      ? "90deg"
      : "circle at center"

  let stopTokens = parts
  if (parts.length > 0 && looksLikeDirection(parts[0])) {
    direction = parts[0]
    stopTokens = parts.slice(1)
  }

  const stops = fillPositions(stopTokens.map(splitStopToken))
  if (stops.length < 1) return null

  return { type, direction, stops }
}

// Convert a named cardinal direction into the appropriate CSS phrasing for
// the gradient type. Angles and already-prefixed strings pass through.
const expandDirection = (type: GradientType, direction: string): string => {
  const dir = direction.trim()
  const isLinear = type === "linear" || type === "repeating-linear"

  if (isLinear) {
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

// Map a direction string between the linear/radial worlds when the gradient
// type changes. Angles aren't meaningful for radial gradients, and the
// `circle at <dir>` syntax isn't valid for linear ones.
export function coerceDirection(
  fromType: GradientType,
  toType: GradientType,
  direction: string
): string {
  const fromLinear = fromType === "linear" || fromType === "repeating-linear"
  const toLinear = toType === "linear" || toType === "repeating-linear"
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
    switch (angleMatch[2].toLowerCase()) {
      case "deg":
        return n
      case "rad":
        return (n * 180) / Math.PI
      case "grad":
        return (n * 9) / 10
      case "turn":
        return n * 360
    }
  }

  const toMatch = dir.match(
    /^to\s+(top|right|bottom|left)(?:\s+(top|right|bottom|left))?$/i
  )
  if (toMatch) {
    const a = toMatch[1].toLowerCase()
    const b = toMatch[2]?.toLowerCase()
    if (!b) {
      // Single side: CSS maps "to top" → 0deg, then clockwise.
      switch (a) {
        case "top":
          return 0
        case "right":
          return 90
        case "bottom":
          return 180
        case "left":
          return 270
      }
    }
    // Diagonal corners.
    const pair = [a, b].sort().join("-")
    switch (pair) {
      case "right-top":
        return 45
      case "bottom-right":
        return 135
      case "bottom-left":
        return 225
      case "left-top":
        return 315
    }
  }

  if (dir === "top") return 0
  if (dir === "right") return 90
  if (dir === "bottom") return 180
  if (dir === "left") return 270

  return null
}

export function degreesToDirection(deg: number): string {
  // Normalize to [0, 360).
  const norm = ((deg % 360) + 360) % 360
  return `${Math.round(norm * 100) / 100}deg`
}

// Sample the gradient color at a given fraction of the timeline (0..1). This
// runs the stops through a CanvasGradient so we get the same interpolation
// CSS would, then reads back the pixel. Used to pick a sensible color when
// the user clicks an empty spot on the preview bar.
export function sampleGradientColor(
  stops: GradientStop[],
  pct: number
): string {
  if (typeof document === "undefined") return stops[0]?.color ?? "#000000"
  if (!stops.length) return "#000000"

  const clamped = Math.max(0, Math.min(1, pct))
  const width = 256
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = 1
  const ctx = canvas.getContext("2d")
  if (!ctx) return stops[0]?.color ?? "#000000"

  const grad = ctx.createLinearGradient(0, 0, width, 0)
  for (const stop of stops) {
    const raw = parseFloat(stop.position)
    if (!Number.isFinite(raw)) continue
    const t = Math.max(0, Math.min(1, raw / 100))
    try {
      grad.addColorStop(t, stop.color)
    } catch {
      // Unparseable color (e.g. var(--x)) — skip; sampling falls back to
      // whatever stops the canvas did accept.
    }
  }
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, 1)

  const x = Math.max(0, Math.min(width - 1, Math.round(clamped * (width - 1))))
  const [r, g, b, a] = ctx.getImageData(x, 0, 1, 1).data
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)})`
}

// Extract a numeric percentage from a stop's position. Returns 0 when the
// position isn't a percentage (e.g. "10px") — the UI treats stop positions
// as percentages and we lose px precision in those cases, but we don't drop
// the stop on the floor.
export function stopPercent(position: string): number {
  const n = parseFloat(position)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

export function formatPercent(pct: number): string {
  // Match Grapick's behaviour of integer-snapping when close, but keep one
  // decimal of precision when the user drags through fractional positions.
  const rounded = Math.round(pct * 10) / 10
  return `${rounded}%`
}

// Pull a canonical 2-axis named radial position out of a direction string.
// Accepts forms like `circle at top left`, `ellipse at center`, `at right`,
// `top left`, or bare keywords. Falls back to `center` when nothing matches.
export function radialPositionFromDirection(direction: string): RadialPosition {
  const raw = direction.toLowerCase().trim()
  // Drop the `circle`/`ellipse` and the `at` keyword.
  const stripped = raw
    .replace(/^(circle|ellipse)\b\s*/i, "")
    .replace(/^at\s+/i, "")
    .trim()

  // Direct hit on the 9-position grid (`top left`, `center`, etc.).
  if (RADIAL_POSITION_SET.has(stripped)) return stripped as RadialPosition

  // Single axis (`top`, `right`, …): center it on the other axis.
  if (RADIAL_AXES.has(stripped)) {
    if (stripped === "center") return "center"
    if (stripped === "top" || stripped === "bottom")
      return stripped as RadialPosition
    return stripped as RadialPosition // "left" / "right" are valid grid entries
  }

  // Two tokens but in opposite order (`left top`): canonicalize to `top left`.
  const tokens = stripped.split(/\s+/)
  if (tokens.length === 2) {
    const [a, b] = tokens
    const swapped = `${b} ${a}`
    if (RADIAL_POSITION_SET.has(swapped)) return swapped as RadialPosition
  }

  return "center"
}

export function radialPositionToDirection(pos: RadialPosition): string {
  return `circle at ${pos}`
}
