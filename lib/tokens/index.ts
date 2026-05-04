/**
 * Source of truth for all Tripcart brand design tokens.
 *
 * Defaults reference Open Props variables (https://open-props.style) so the
 * design system has a well-considered baseline out of the box. Open Props is
 * loaded into the GrapesJS canvas iframe via `canvas.styles` in editor-shell;
 * any environment that renders authored content must also load Open Props for
 * these `var(...)` references to resolve.
 */

import { toKebab } from "@/lib/toKebab"

export type TokenValue = {
  label: string
  value: string
}

export type TokenSchema = {
  colors: Record<string, TokenValue>
  typography: Record<string, TokenValue>
}

export const defaultTokens: TokenSchema = {
  colors: {
    background: { label: "Background", value: "var(--gray-12)" },
    foreground: { label: "Foreground", value: "var(--gray-0)" },
    card: { label: "Card", value: "var(--gray-10)" },
    cardForeground: { label: "Card Foreground", value: "var(--gray-0)" },
    popover: { label: "Popover", value: "var(--gray-10)" },
    popoverForeground: { label: "Popover Foreground", value: "var(--gray-0)" },
    primary: { label: "Primary", value: "var(--blue-6)" },
    primaryForeground: { label: "Primary Foreground", value: "var(--gray-0)" },
    secondary: { label: "Secondary", value: "var(--gray-9)" },
    secondaryForeground: {
      label: "Secondary Foreground",
      value: "var(--gray-0)",
    },
    muted: { label: "Muted", value: "var(--gray-9)" },
    mutedForeground: { label: "Muted Foreground", value: "var(--gray-5)" },
    accent: { label: "Accent", value: "var(--gray-9)" },
    accentForeground: { label: "Accent Foreground", value: "var(--gray-0)" },
    // Open Props ships solid palette steps; alpha overlays are derived via
    // color-mix so border/input still track the active foreground.
    border: {
      label: "Border",
      value: "color-mix(in oklch, var(--gray-0) 10%, transparent)",
    },
    input: {
      label: "Input",
      value: "color-mix(in oklch, var(--gray-0) 15%, transparent)",
    },
  },

  typography: {
    body: { label: "Body Font", value: "var(--font-sans)" },
    heading: { label: "Heading Font", value: "var(--font-sans)" },
  },
}

export const tokenToCssVar = (
  category: keyof TokenSchema,
  key: string
): string => {
  // Colours follow the shadcn convention — no prefix (--background,
  // --primary, --card-foreground, etc.). Other categories keep their
  // namespace prefix so they don't collide with Open Props or shadcn.
  const prefixMap: Record<keyof TokenSchema, string | null> = {
    colors: null,
    typography: "font",
  }
  const prefix = prefixMap[category]
  const name = toKebab(key)
  return prefix ? `--${prefix}-${name}` : `--${name}`
}

export const tokensToStyleObject = (
  tokens: TokenSchema
): Record<string, string> => {
  const styles: Record<string, string> = {}
  for (const [category, group] of Object.entries(tokens)) {
    for (const [key, token] of Object.entries(group)) {
      styles[tokenToCssVar(category as keyof TokenSchema, key)] = token.value
    }
  }

  return styles
}

/**
 * Build a TokenSchema by overlaying values pulled from a CSS style object
 * (typically the styles attached to the persisted `:root` CssRule). Token
 * keys absent from the style object keep their existing value, so this is
 * safe across schema additions.
 */
export const tokensFromStyleObject = (
  base: TokenSchema,
  styles: Record<string, string>
): TokenSchema => {
  const next = structuredClone(base)
  for (const [category, group] of Object.entries(next)) {
    for (const [key, token] of Object.entries(group)) {
      const varName = tokenToCssVar(category as keyof TokenSchema, key)
      const stored = styles[varName]
      if (typeof stored === "string" && stored.length > 0) {
        token.value = stored
      }
    }
  }
  return next
}
