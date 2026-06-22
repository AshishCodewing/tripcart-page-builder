// Style declaration block serialization (the `prop:value;` body of a rule).

import type { Rule } from "../types"

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
