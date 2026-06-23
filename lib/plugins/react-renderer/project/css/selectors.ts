// Selector coercion + serialization for a project snapshot's CSS rules.

import type { Rule } from "../types"

// GrapesJS persists selectors as either plain strings or `{ name, type, ... }`
// objects (the live model uses Selector instances). The published Rule type
// declares `selectors?: string[]`, but the actual JSON snapshot is mixed —
// coerce here so the rest of the renderer can stay typed.
export const coerceSelectorName = (entry: unknown): string => {
  if (typeof entry === "string") return entry
  if (entry && typeof entry === "object") {
    const e = entry as { name?: unknown; label?: unknown }
    if (typeof e.name === "string") return e.name
    if (typeof e.label === "string") return e.label
  }
  return ""
}

// Heuristic: a leading `#` is preserved as an id selector; `.` is left alone
// (already class-prefixed); otherwise we assume class and prefix with `.`.
export const getFromSelectorName = (selector = ""): string => {
  if (!selector) return ""
  const first = selector.charAt(0)
  if (first === "#" || first === ".") return selector
  return `.${selector}`
}

export const selectorsToString = (
  rule: Rule,
  opts: { skipState?: boolean; skipAdd?: boolean } = {}
): string => {
  const out: string[] = []
  const { state, selectorsAdd, selectors = [] } = rule
  const sel = (selectors as Array<unknown>)
    .map((s) => getFromSelectorName(coerceSelectorName(s)))
    .filter(Boolean)
    .join("")
  const stateSuffix = state && !opts.skipState ? `:${state}` : ""
  if (sel) out.push(`${sel}${stateSuffix}`)
  if (selectorsAdd && !opts.skipAdd) out.push(selectorsAdd)
  return out.join(", ")
}
