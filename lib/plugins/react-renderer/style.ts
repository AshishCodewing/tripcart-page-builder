// Public entry point for style normalization. The case-conversion helpers live
// in ./case-utils and the per-shape parsers in ./style-parsers; this module
// re-exports the public surface and owns the dispatch on input shape.

import type { CSSProperties } from "react"

import {
  kebabKeysToCamelStyle,
  parseStringStyle,
  parseStyleArray,
} from "./style-parsers"

export { camelToKebab, kebabToCamel, camelKeysToKebabStyle } from "./case-utils"

// Coerce whatever GrapesJS hands us into a React style object, dispatching on
// the input shape (object / string / array).
export const normalizeStyleObject = (
  value: unknown
): CSSProperties | undefined => {
  if (!value) return undefined
  if (Array.isArray(value)) return parseStyleArray(value)
  if (typeof value === "string") return parseStringStyle(value)
  if (typeof value === "object") {
    return kebabKeysToCamelStyle(value as Record<string, unknown>)
  }
  return undefined
}
