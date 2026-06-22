// Rule-level assembly: combine a selector with its declaration block, and
// build the full CSS string for a rule set (plain rules first, then grouped
// media/at-rules sorted by breakpoint).

import type { Rule } from "../types"

import { selectorsToString } from "./selectors"
import { styleToString } from "./declarations"
import { getAtRule, sortMediaObject, type AtRules } from "./media"

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
