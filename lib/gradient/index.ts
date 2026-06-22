// Pure helpers for parsing and serializing CSS gradient values, ported from
// the grapesjs-style-gradient plugin so we can drive a fully-React Style
// Manager field without taking the Grapick imperative widget along for the
// ride. Split across parse/serialize/direction/radial/color modules; this
// barrel is the public entry point (import from "@/lib/gradient").

export {
  GRADIENT_TYPES,
  RADIAL_NAMED_DIRS,
  RADIAL_POSITIONS,
  DEFAULT_GRADIENT,
  type GradientType,
  type GradientStop,
  type ParsedGradient,
  type RadialNamedDir,
  type RadialPosition,
} from "./types"
export { parseGradient } from "./parse"
export { toGradient } from "./serialize"
export {
  coerceDirection,
  directionToDegrees,
  degreesToDirection,
} from "./direction"
export {
  radialPositionFromDirection,
  radialPositionToDirection,
} from "./radial"
export { sampleGradientColor, stopPercent, formatPercent } from "./color"
