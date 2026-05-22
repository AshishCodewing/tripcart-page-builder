/**
 * Source of truth for Tripcart's bundled brand defaults.
 *
 * The defaults reference Open Props variables (https://open-props.style)
 * so the design system has a well-considered baseline. Open Props is
 * loaded into the GrapesJS canvas iframe via `canvas.styles` in
 * editor-shell; any environment that renders authored content must also
 * load Open Props for these `var(...)` references to resolve.
 *
 * Shape mirrors WordPress `theme.json`:
 *   - `defaultTheme.settings` is the *registry* of design tokens.
 *   - `defaultTheme.styles`   is reserved for default style application
 *     (root, per-element, per-component). Empty in this PR; populated
 *     in the styles-application follow-up.
 *
 * `tokensFromStored` rehydrates a `Theme` from a persisted `:root` style
 * object. It accepts both the new `--tc--preset--*` variable names and
 * the pre-migration `--theme-*` / `--font-*` legacy aliases — so existing
 * GrapesJS projects keep loading correctly.
 */

import {
  legacyVarName,
  presetVarName,
  type PresetCategory,
} from "@/lib/theme/compile"
import type { Theme, Token } from "@/lib/theme/schema"

export type ActivePresetId = Partial<Record<PresetCategory, string>>

const colorPalette: Token[] = [
  { slug: "background", name: "Background", value: "hsl(var(--gray-0-hsl))" },
  { slug: "foreground", name: "Foreground", value: "hsl(var(--gray-12-hsl))" },
  { slug: "card", name: "Card", value: "hsl(var(--gray-0-hsl))" },
  {
    slug: "cardForeground",
    name: "Card Foreground",
    value: "hsl(var(--gray-12-hsl))",
  },
  { slug: "popover", name: "Popover", value: "hsl(var(--gray-0-hsl))" },
  {
    slug: "popoverForeground",
    name: "Popover Foreground",
    value: "hsl(var(--gray-12-hsl))",
  },
  { slug: "primary", name: "Primary", value: "hsl(var(--blue-6-hsl))" },
  {
    slug: "primaryForeground",
    name: "Primary Foreground",
    value: "hsl(var(--gray-0-hsl))",
  },
  { slug: "secondary", name: "Secondary", value: "hsl(var(--gray-2-hsl))" },
  {
    slug: "secondaryForeground",
    name: "Secondary Foreground",
    value: "hsl(var(--gray-12-hsl))",
  },
  { slug: "muted", name: "Muted", value: "hsl(var(--gray-2-hsl))" },
  {
    slug: "mutedForeground",
    name: "Muted Foreground",
    value: "hsl(var(--gray-7-hsl))",
  },
  { slug: "accent", name: "Accent", value: "hsl(var(--gray-2-hsl))" },
  {
    slug: "accentForeground",
    name: "Accent Foreground",
    value: "hsl(var(--gray-12-hsl))",
  },
  { slug: "destructive", name: "Destructive", value: "hsl(var(--red-6-hsl))" },
  { slug: "warning", name: "Warning", value: "hsl(var(--yellow-6-hsl))" },
  {
    slug: "warningForeground",
    name: "Warning Foreground",
    value: "hsl(var(--gray-0-hsl))",
  },
  { slug: "success", name: "Success", value: "hsl(var(--green-6-hsl))" },
  {
    slug: "successForeground",
    name: "Success Foreground",
    value: "hsl(var(--gray-0-hsl))",
  },
  {
    slug: "border",
    name: "Border",
    value: "color-mix(in oklch, hsl(var(--gray-12-hsl)) 10%, transparent)",
  },
  {
    slug: "input",
    name: "Input",
    value: "color-mix(in oklch, hsl(var(--gray-12-hsl)) 15%, transparent)",
  },
  { slug: "ring", name: "Ring", value: "hsl(var(--blue-6-hsl))" },
]

const fontFamilies: Token[] = [
  { slug: "body", name: "Body Font", value: "var(--font-sans)" },
  { slug: "heading", name: "Heading Font", value: "var(--font-sans)" },
]

// Default theme = "blue + system-sans". Matches COLOR_PRESETS[blue] and
// TYPOGRAPHY_PRESETS[system-sans] exactly, so on first run the preset
// cards reflect the active state.
export const defaultTheme: Theme = {
  version: 1,
  settings: {
    color: { palette: colorPalette },
    typography: { fontFamilies },
  },
}

export const defaultActivePresetId: ActivePresetId = {
  color: "blue",
  "font-family": "system-sans",
}

/**
 * Categories we know how to hydrate from a stored `:root` style object.
 * Each entry pairs a `PresetCategory` (used to build the variable name)
 * with an accessor that returns the matching `Token[]` slot in the
 * mutable theme draft.
 */
const HYDRATABLE: ReadonlyArray<{
  category: PresetCategory
  pick: (draft: Theme) => Token[] | undefined
}> = [
  { category: "color", pick: (t) => t.settings.color?.palette },
  { category: "font-family", pick: (t) => t.settings.typography?.fontFamilies },
  { category: "font-weight", pick: (t) => t.settings.typography?.fontWeights },
  { category: "line-height", pick: (t) => t.settings.typography?.lineHeights },
  {
    category: "letter-spacing",
    pick: (t) => t.settings.typography?.letterSpacings,
  },
  { category: "spacing", pick: (t) => t.settings.spacing?.sizes },
  { category: "radius", pick: (t) => t.settings.border?.radii },
  { category: "border-width", pick: (t) => t.settings.border?.widths },
  { category: "border-style", pick: (t) => t.settings.border?.styles },
  { category: "shadow", pick: (t) => t.settings.shadow?.presets },
]

/**
 * Overlay stored CSS variable values onto a base theme draft. Tokens
 * absent from `styles` keep their default value, so this is safe across
 * additive schema changes.
 */
export const tokensFromStored = (
  base: Theme,
  styles: Record<string, string>
): Theme => {
  const next = structuredClone(base)
  for (const { category, pick } of HYDRATABLE) {
    const tokens = pick(next)
    if (!tokens) continue
    for (const token of tokens) {
      const newName = presetVarName(category, token.slug)
      const legacy = legacyVarName(category, token.slug)
      const stored = styles[newName] ?? (legacy ? styles[legacy] : undefined)
      if (typeof stored === "string" && stored.length > 0) {
        token.value = stored
      }
    }
  }
  return next
}
