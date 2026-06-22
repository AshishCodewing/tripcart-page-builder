// Pure value-shape parsing + commit composition for NumberInput. No React —
// unit-testable in isolation.

import type { Property, PropertyNumber } from "grapesjs"

import type { TokenCategory } from "./open-props-tokens"

const BORDER_RADIUS_RE = /border.*radius/
// Number with optional unit suffix: 16, -4, 0.5, .5, 16px, 100%, -1.5rem.
// Anything else (var(...), calc(...), auto, etc.) falls through to "fixed".
const VALUE_SHAPE_RE = /^(-?(?:\d+\.?\d*|\.\d+))([a-zA-Z%]*)$/

export type ValueShape =
  | { kind: "empty" }
  | { kind: "numeric"; number: string; unit: string }
  | { kind: "fixed"; value: string }

export function parseValueShape(raw: string): ValueShape {
  const trimmed = raw.trim()
  if (!trimmed) return { kind: "empty" }
  const m = trimmed.match(VALUE_SHAPE_RE)
  if (m) return { kind: "numeric", number: m[1], unit: m[2] }
  return { kind: "fixed", value: trimmed }
}

// Empty-string unit (line-height accepts unitless `1.5`) displays as "—" so
// the trigger never renders an invisible label.
export const displayUnit = (u: string): string => (u === "" ? "—" : u)

// The bare numeric portion of a composed value ("279deg" → "279"), or "" when
// the value isn't numeric. Used to feed the slider + type="number" input.
export const numericPart = (value: string): string => {
  const s = parseValueShape(value)
  return s.kind === "numeric" ? s.number : ""
}

// Outcome of committing the current draft. Pure: the component applies the
// side effects (onCommit / setDraft).
export type CommitResolution =
  | { action: "clear" }
  // `reformat` = also re-display the composed value in the input (numeric
  // paths); fixed-values and bare-number-no-units commit without reformatting.
  | { action: "commit"; value: string; reformat: boolean }

// Decide what a draft string should commit to, given the property's unit
// config. Mirrors the original NumberInput.commit() branch ladder.
export function resolveNumberCommit(
  draft: string,
  units: string[],
  currentUnit: string
): CommitResolution {
  const next = parseValueShape(draft)
  if (next.kind === "empty") return { action: "clear" }
  // Fixed-values (var, calc, auto, …) pass through verbatim.
  if (next.kind === "fixed") {
    return { action: "commit", value: next.value, reformat: false }
  }
  // numeric with explicit unit — pass through.
  if (next.unit) {
    return {
      action: "commit",
      value: `${next.number}${next.unit}`,
      reformat: true,
    }
  }
  // numeric, no unit — compose with current/default. For line-height the
  // default is "" (unitless) so we commit just the bare number.
  if (units.length) {
    const useUnit = currentUnit || units[0] || ""
    return {
      action: "commit",
      value: useUnit ? `${next.number}${useUnit}` : next.number,
      reformat: true,
    }
  }
  return { action: "commit", value: next.number, reformat: false }
}

// A property is "length-like" when it advertises a unit list. z-index /
// flex-grow have no units and so don't get the variable picker.
export function varCategoriesFor(
  property: Property
): TokenCategory[] | undefined {
  const units = (property as PropertyNumber).getUnits?.() ?? []
  if (!units.length) return undefined
  const name = property.getName()
  if (BORDER_RADIUS_RE.test(name)) return ["border-radius"]
  if (name === "font-size") return ["font-size"]
  if (name === "line-height") return ["font-lineheight"]
  if (name === "letter-spacing") return ["font-letterspacing"]
  return ["size"]
}
