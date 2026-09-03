// CSS → theme document, for one value.
//
//   document : "var:preset|color|primaryForeground"
//   CSS      : "var(--tc--preset--color--primary-foreground)"
//
// `resolveStyleRef` (compile.ts) goes document → CSS. This is the inverse,
// which needs the theme: the variable name carries the KEBAB form of a slug,
// and slugs may be camelCase, so the original slug can only be recovered by
// matching against the tenant's registered tokens. It is what lets a Style
// Manager edit (which speaks CSS) keep a token reference a token reference.
//
// Anything that isn't a recognised preset var — a hex, a length, an unknown
// variable — passes through untouched. Those are valid document values too.

import { presetVarName, type PresetCategory } from "@/lib/theme/compile"
import type { Theme } from "@/lib/theme/schema"
import { tokenPaths } from "@/lib/theme/token-paths"

const CATEGORIES = Object.keys(tokenPaths) as readonly PresetCategory[]

export const cssVarToStyleRef = (value: string, theme: Theme): string => {
  const match = /^var\(\s*(--tc--preset--[a-z0-9-]+)\s*\)$/.exec(value.trim())
  if (!match) return value

  const varName = match[1]
  for (const category of CATEGORIES) {
    const token = (tokenPaths[category].get(theme) ?? []).find(
      (t) => presetVarName(category, t.slug) === varName
    )
    if (token) return `var:preset|${category}|${token.slug}`
  }
  return value
}
