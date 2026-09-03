// Puts the tenant's own font tokens at the top of the font dropdowns.
//
// The controls themselves stay the page editor's (see theme-style-sectors.ts);
// this only widens their option list, so a tenant picks "Heading" and the
// declaration stays a reference to that token — following the palette — rather
// than freezing today's font stack.
//
// Applied at runtime rather than in the sector config because the options
// depend on the tenant's theme, and because the built-in list only exists on
// the live property (the editor declares these two as bare built-ins).

import type { Editor, PropertySelect } from "grapesjs"

import { presetVarName, type PresetCategory } from "@/lib/theme/compile"
import type { Theme, Token } from "@/lib/theme/schema"
import { tokenPaths } from "@/lib/theme/token-paths"

type Option = { id: string; label: string }

const TOKEN_PREFIX = "var(--tc--preset--"

const TOKEN_DROPDOWNS: readonly {
  sector: string
  property: string
  category: PresetCategory
}[] = [
  { sector: "typography", property: "font-family", category: "font-family" },
  { sector: "typography", property: "font-weight", category: "font-weight" },
]

const tokenOption = (category: PresetCategory, token: Token): Option => ({
  id: `var(${presetVarName(category, token.slug)})`,
  label: token.name || token.slug,
})

/**
 * Prepend theme tokens to each font dropdown, keeping whatever the editor's own
 * property already offers. Safe to call repeatedly: token options are our own
 * namespace, so they are filtered out before being re-added and never
 * accumulate.
 */
export const applyThemeTokenOptions = (editor: Editor, theme: Theme): void => {
  for (const { sector, property, category } of TOKEN_DROPDOWNS) {
    const prop = editor.StyleManager.getProperty(sector, property) as
      | PropertySelect
      | undefined
    if (!prop?.setOptions) continue

    const builtIns = (prop.getOptions() as Option[]).filter(
      (o) => !String(prop.getOptionId(o)).startsWith(TOKEN_PREFIX)
    )
    const tokens = tokenPaths[category].get(theme) ?? []
    prop.setOptions([
      ...tokens.map((token) => tokenOption(category, token)),
      ...builtIns,
    ])
  }
}
