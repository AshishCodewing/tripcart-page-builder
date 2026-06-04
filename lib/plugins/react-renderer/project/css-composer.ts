// Stringifier for the `styles` array in a project snapshot. It rebuilds plain
// rules + grouped media/at-rules into a single CSS string, mirroring how the
// live `editor.Css` module emits CSS. Used outside the editor (e.g. in a
// Next.js publish route) where pulling in the full editor is unwanted.

import type { Rule } from "./types"

// GrapesJS persists selectors as either plain strings or `{ name, type, ... }`
// objects (the live model uses Selector instances). The published Rule type
// in the SDK declares `selectors?: string[]`, but the actual JSON snapshot
// is mixed — coerce here so the rest of the renderer can stay typed.
const coerceSelectorName = (entry: unknown): string => {
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

type AtRules = Record<string, Rule[]>

export class CssComposer {
  private rules: Rule[]

  constructor(rules: Rule[]) {
    this.rules = rules
  }

  getAll(): Rule[] {
    return this.rules
  }

  getRulesByGroup(group: string): Rule[] {
    return this.rules.filter((r) => r.group === group)
  }

  getAtRule(rule: Rule): string {
    const { atRuleType, mediaText } = rule
    const head = atRuleType ? `@${atRuleType}` : mediaText ? "@media" : ""
    return head + (mediaText && head ? ` ${mediaText}` : "")
  }

  selectorsToString(
    rule: Rule,
    opts: { skipState?: boolean; skipAdd?: boolean } = {}
  ): string {
    const out: string[] = []
    const { state, selectorsAdd, selectors = [] } = rule
    const sel = (selectors as Array<unknown>)
      .map((s) => this.getFromSelectorName(coerceSelectorName(s)))
      .filter(Boolean)
      .join("")
    const stateSuffix = state && !opts.skipState ? `:${state}` : ""
    if (sel) out.push(`${sel}${stateSuffix}`)
    if (selectorsAdd && !opts.skipAdd) out.push(selectorsAdd)
    return out.join(", ")
  }

  // Heuristic: a leading `#` is preserved as an id selector; `.` is left
  // alone (already class-prefixed); otherwise we assume class and prefix
  // with `.`.
  getFromSelectorName(selector = ""): string {
    if (!selector) return ""
    const first = selector.charAt(0)
    if (first === "#" || first === ".") return selector
    return `.${selector}`
  }

  styleToString(rule: Partial<Rule> = {}): string {
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

  getDeclaration(rule: Rule): string {
    const { singleAtRule } = rule as { singleAtRule?: boolean }
    const sel = this.selectorsToString(rule)
    const decls = this.styleToString(rule)
    if ((sel || singleAtRule) && decls) {
      return singleAtRule ? decls : `${sel}{${decls}}`
    }
    return ""
  }

  buildFromRule(rule: Rule): string {
    const sel = this.selectorsToString(rule)
    const { selectorsAdd, singleAtRule } = rule as {
      selectorsAdd?: string
      singleAtRule?: boolean
    }
    if (sel || selectorsAdd || singleAtRule) {
      return this.getDeclaration(rule)
    }
    return ""
  }

  sortMediaObject(items: AtRules = {}): { key: string; value: Rule[] }[] {
    const arr: { key: string; value: Rule[] }[] = []
    for (const key in items) arr.push({ key, value: items[key] })
    return arr.sort((a, b) => {
      // If both queries are min-width, smaller goes first; otherwise
      // larger goes first (matches the SDK ordering rule).
      const bothMin = [a.key, b.key].every((k) => k.includes("min-width"))
      const left = bothMin ? a.key : b.key
      const right = bothMin ? b.key : a.key
      return firstNumeric(left) - firstNumeric(right)
    })
  }

  getCssAsString(): string {
    if (!this.rules?.length) return ""
    const groups: AtRules = {}
    const flat: string[] = []
    this.rules.forEach((rule) => {
      const at = this.getAtRule(rule)
      if (at) {
        ;(groups[at] ||= []).push(rule)
        return
      }
      flat.push(this.buildFromRule(rule))
    })
    this.sortMediaObject(groups).forEach(({ key, value }) => {
      let body = ""
      value.forEach((r) => {
        const built = this.buildFromRule(r)
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
}
