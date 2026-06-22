// Pure helpers + constants for the GradientPicker compound component. Kept
// separate so the numeric/label logic is unit-testable; the components
// (and the pointer-drag/keyboard handling) stay in gradient-picker.tsx.

import {
  RADIAL_POSITIONS,
  stopPercent,
  type GradientStop,
  type GradientType,
  type RadialPosition,
} from "@/lib/gradient"

export const MIN_STOPS = 2
export const DRAG_THRESHOLD_PX = 4

export const CHECKERBOARD =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill-opacity='.18'><path d='M5 0h5v5H5zM0 5h5v5H0z'/></svg>\")"

export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n))

export const sortStops = (stops: GradientStop[]): GradientStop[] =>
  [...stops].sort((a, b) => stopPercent(a.position) - stopPercent(b.position))

export const baseTypeOf = (t: GradientType): "linear" | "radial" =>
  t === "linear" || t === "repeating-linear" ? "linear" : "radial"

export const titleCase = (s: string) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase())

export const TYPE_LABELS: Record<GradientType, string> = {
  linear: "Linear",
  radial: "Radial",
  "repeating-linear": "Repeating Linear",
  "repeating-radial": "Repeating Radial",
}

export const RADIAL_POSITION_LABELS = Object.fromEntries(
  RADIAL_POSITIONS.map((p) => [p, titleCase(p)])
) as Record<RadialPosition, string>
