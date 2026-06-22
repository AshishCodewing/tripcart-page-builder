// Radial gradient position helpers: map between direction strings and the
// canonical 9-position grid.

import { RADIAL_POSITIONS, type RadialPosition } from "./types"

const RADIAL_POSITION_SET = new Set<string>(RADIAL_POSITIONS)
const RADIAL_AXES = new Set(["top", "bottom", "left", "right", "center"])

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

  // Single axis (`top`, `right`, …): valid grid entries on their own.
  if (RADIAL_AXES.has(stripped)) return stripped as RadialPosition

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
