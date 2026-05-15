import type { PropertyNumberProps } from "grapesjs"

// Strings inside `fixedValues` are joined into one alternation regex anchored
// at `^` by GrapesJS — see node_modules/grapesjs/dist/grapes.mjs:49996. Each
// entry that matches a prefix of the input is preserved verbatim and the unit
// is cleared. `var\([^)]*\)` and `calc\([^)]*\)` capture single-level paren
// expressions, which covers `var(--token)` and `calc(100% - 20px)`. Nested
// expressions (e.g. `calc(var(--a) + 10px)`) truncate at the first `)` — an
// accepted trade since this project does not author nested calc.
export const LENGTH_FIXED_VALUES: string[] = [
  "var\\([^)]*\\)",
  "calc\\([^)]*\\)",
  "auto",
  "inherit",
  "initial",
  "unset",
  "none",
  "fit-content",
  "max-content",
  "min-content",
]

const SIZE_UNITS = ["px", "%", "em", "rem", "vh", "vw"]
const BOX_UNITS = ["px", "%", "em", "rem"]
const FONT_SIZE_UNITS = ["px", "rem", "em", "%"]
// Empty-string entry lets PropertyNumber store a unitless line-height like
// `1.5` — GrapesJS treats `unit === ""` as "no suffix in the composed value".
const LINE_HEIGHT_UNITS = ["", "px", "em", "%"]
const LETTER_SPACING_UNITS = ["px", "em", "rem"]

export const LENGTH_UNITS_BY_PROPERTY: Record<string, string[]> = {
  width: SIZE_UNITS,
  height: SIZE_UNITS,
  "min-width": SIZE_UNITS,
  "min-height": SIZE_UNITS,
  "max-width": SIZE_UNITS,
  "max-height": SIZE_UNITS,
  top: BOX_UNITS,
  right: BOX_UNITS,
  bottom: BOX_UNITS,
  left: BOX_UNITS,
  "margin-top": BOX_UNITS,
  "margin-right": BOX_UNITS,
  "margin-bottom": BOX_UNITS,
  "margin-left": BOX_UNITS,
  "padding-top": BOX_UNITS,
  "padding-right": BOX_UNITS,
  "padding-bottom": BOX_UNITS,
  "padding-left": BOX_UNITS,
  "row-gap": BOX_UNITS,
  "column-gap": BOX_UNITS,
  "flex-basis": BOX_UNITS,
  "border-top-left-radius": BOX_UNITS,
  "border-top-right-radius": BOX_UNITS,
  "border-bottom-right-radius": BOX_UNITS,
  "border-bottom-left-radius": BOX_UNITS,
  "font-size": FONT_SIZE_UNITS,
  "line-height": LINE_HEIGHT_UNITS,
  "letter-spacing": LETTER_SPACING_UNITS,
}

type LengthPropExtra = Omit<
  PropertyNumberProps,
  "property" | "type" | "units" | "fixedValues"
> & {
  extend?: string
}

export function lengthProp(
  name: string,
  extra: LengthPropExtra = {}
): PropertyNumberProps & { extend?: string } {
  const units = LENGTH_UNITS_BY_PROPERTY[name] ?? BOX_UNITS
  return {
    property: name,
    type: "number",
    units,
    fixedValues: LENGTH_FIXED_VALUES,
    ...extra,
  }
}
