// At-rule / media-query handling: heads + breakpoint ordering.

import type { Rule } from "../types"

export type AtRules = Record<string, Rule[]>

// Pull the first numeric token off a media query string so we can sort
// `min-width: 480px` style queries by their numeric breakpoint.
const firstNumeric = (input: string): number => {
  const m = /(-?\d*\.?\d+)\w{0,}/.exec(input)
  return m ? parseFloat(m[1]) : Number.MAX_VALUE
}

export const getAtRule = (rule: Rule): string => {
  const { atRuleType, mediaText } = rule
  const head = atRuleType ? `@${atRuleType}` : mediaText ? "@media" : ""
  return head + (mediaText && head ? ` ${mediaText}` : "")
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
