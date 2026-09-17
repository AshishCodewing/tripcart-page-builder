// Pure helpers behind the Style panel's CSS code view: render the Style
// Manager's current target as an editable rule, and turn the edited text back
// into a style patch for `StyleManager.addStyleTargets`.

export type StyleObject = Record<string, string>

export type ParsedRule = { style?: Record<string, unknown> | string }

/** Drop GrapesJS-internal keys (`__p`) and non-string values. */
export function cleanStyle(style: Record<string, unknown>): StyleObject {
  const out: StyleObject = {}
  for (const [key, value] of Object.entries(style)) {
    if (key.startsWith("__")) continue
    if (typeof value === "string" && value !== "") out[key] = value
  }
  return out
}

/**
 * `.cls:hover {\n  color: red;\n}` — wrapped in the at-rule (`@media …`) when
 * the target is device-specific, so the text reads like the exported CSS.
 */
export function formatRuleCss({
  selector,
  atRule,
  style,
}: {
  selector: string
  atRule?: string
  style: StyleObject
}): string {
  const indent = atRule ? "  " : ""
  const decls = Object.entries(style).map(
    ([prop, value]) => `${indent}  ${prop}: ${value};`
  )
  const rule = [`${indent}${selector} {`, ...decls, `${indent}}`].join("\n")
  return atRule ? `${atRule} {\n${rule}\n}\n` : `${rule}\n`
}

/**
 * Extracts the declarations of the (single) rule in `text`. The selector and
 * at-rule the user sees are informational: only the declarations are applied,
 * to whatever the Style Manager targets. Returns `null` when the CSS doesn't
 * parse, so a half-typed buffer never reaches the model.
 */
export function parseRuleStyle(
  text: string,
  parse: (css: string) => ParsedRule[]
): StyleObject | null {
  let rules: ParsedRule[]
  try {
    rules = parse(text)
  } catch {
    return null
  }
  const rule = rules.find(
    (r) => typeof r.style === "object" && Object.keys(r.style).length > 0
  )
  if (typeof rule?.style === "object") return cleanStyle(rule.style)
  // No declarations: a well-formed empty rule clears the target, anything
  // without a block is not a rule at all.
  return /\{[\s;]*\}\s*(\}\s*)?$/.test(text.trim()) ? {} : null
}

/** Patch that turns `prev` into `next`; removed properties are set to `""`. */
export function diffStyle(prev: StyleObject, next: StyleObject): StyleObject {
  const patch: StyleObject = {}
  for (const key of Object.keys(prev)) {
    if (!(key in next)) patch[key] = ""
  }
  for (const [key, value] of Object.entries(next)) {
    if (prev[key] !== value) patch[key] = value
  }
  return patch
}
