// Pure CSS-string builders for a project snapshot's `styles` array, mirroring
// how the live `editor.Css` module emits CSS. Stateless free functions so each
// step (selectors, declarations, media sort) is unit-testable; CssComposer
// just holds the rules and orchestrates these.

import type { Rule } from "./types"

type AtRules = Record<string, Rule[]>

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

// Pull the first numeric token off a media query string so we can sort
// `min-width: 480px` style queries by their numeric breakpoint.
const firstNumeric = (input: string): number => {
  const m = /(-?\d*\.?\d+)\w{0,}/.exec(input)
  return m ? parseFloat(m[1]) : Number.MAX_VALUE
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

export const getAtRule = (rule: Rule): string => {
  const { atRuleType, mediaText } = rule
  const head = atRuleType ? `@${atRuleType}` : mediaText ? "@media" : ""
  return head + (mediaText && head ? ` ${mediaText}` : "")
}

export const styleToString = (rule: Partial<Rule> = {}): string => {
  const out: string[] = []
  const { style = {}, important } = rule as {
    style?: Record<string, string | string[]>
    important?: boolean | string[]
  }
  for (const prop in style) {
    // Skip GrapesJS internal props (prefixed `__`).
    if (prop.startsWith("__")) continue
    const isImportant = Array.isArray(important)
      ? important.includes(prop)
      : !!important
    const value = style[prop]
    const values = Array.isArray(value) ? value : [value]
    values.forEach((v) => {
      const decl = `${v}${isImportant ? " !important" : ""}`
      if (decl) out.push(`${prop}:${decl};`)
    })
  }
  return out.join("")
}

export const getDeclaration = (rule: Rule): string => {
  const { singleAtRule } = rule as { singleAtRule?: boolean }
  const sel = selectorsToString(rule)
  const decls = styleToString(rule)
  if ((sel || singleAtRule) && decls) {
    return singleAtRule ? decls : `${sel}{${decls}}`
  }
  return ""
}

export const buildFromRule = (rule: Rule): string => {
  const sel = selectorsToString(rule)
  const { selectorsAdd, singleAtRule } = rule as {
    selectorsAdd?: string
    singleAtRule?: boolean
  }
  if (sel || selectorsAdd || singleAtRule) {
    return getDeclaration(rule)
  }
  return ""
}

export const sortMediaObject = (
  items: AtRules = {}
): { key: string; value: Rule[] }[] => {
  const arr: { key: string; value: Rule[] }[] = []
  for (const key in items) arr.push({ key, value: items[key] })
  return arr.sort((a, b) => {
    // If both queries are min-width, smaller goes first; otherwise larger goes
    // first (matches the SDK ordering rule).
    const bothMin = [a.key, b.key].every((k) => k.includes("min-width"))
    const left = bothMin ? a.key : b.key
    const right = bothMin ? b.key : a.key
    return firstNumeric(left) - firstNumeric(right)
  })
}

// Build the full CSS string for a rule set: plain rules first, then grouped
// media/at-rules sorted by breakpoint.
export const rulesToCss = (rules: Rule[]): string => {
  if (!rules?.length) return ""
  const groups: AtRules = {}
  const flat: string[] = []
  rules.forEach((rule) => {
    const at = getAtRule(rule)
    if (at) {
      ;(groups[at] ||= []).push(rule)
      return
    }
    flat.push(buildFromRule(rule))
  })
  sortMediaObject(groups).forEach(({ key, value }) => {
    let body = ""
    value.forEach((r) => {
      const built = buildFromRule(r)
      if ((r as { singleAtRule?: boolean }).singleAtRule) {
        flat.push(`${key}{${built}}`)
      } else {
        body += built
      }
    })
    if (body) flat.push(`${key}{${body}}`)
  })
  return flat.join("\n")
}
