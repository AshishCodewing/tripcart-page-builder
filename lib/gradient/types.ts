// Shared types and constants for the gradient parser/serializer. Pure data;
// no runtime logic lives here.

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

export const DEFAULT_GRADIENT: ParsedGradient = {
  type: "linear",
  direction: "90deg",
  stops: [
    { color: "#000000", position: "0%" },
    { color: "#ffffff", position: "100%" },
  ],
}

export const isLinearType = (type: GradientType): boolean =>
  type === "linear" || type === "repeating-linear"
