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

// Default theme is "blue + system-sans" — a light, neutral baseline. It
// matches `COLOR_PRESETS[blue]` and `TYPOGRAPHY_PRESETS[system-sans]` exactly,
// so on first run the preset cards reflect the active state and applying a
// different preset is a clean swap rather than a custom-token edit.
export const defaultTokens: TokenSchema = {
  colors: {
    background: { label: "Background", value: "hsl(var(--gray-0-hsl))" },
    foreground: { label: "Foreground", value: "hsl(var(--gray-12-hsl))" },
    card: { label: "Card", value: "hsl(var(--gray-0-hsl))" },
    cardForeground: {
      label: "Card Foreground",
      value: "hsl(var(--gray-12-hsl))",
    },
    popover: { label: "Popover", value: "hsl(var(--gray-0-hsl))" },
    popoverForeground: {
      label: "Popover Foreground",
      value: "hsl(var(--gray-12-hsl))",
    },
    primary: { label: "Primary", value: "hsl(var(--blue-6-hsl))" },
    primaryForeground: {
      label: "Primary Foreground",
      value: "hsl(var(--gray-0-hsl))",
    },
    secondary: { label: "Secondary", value: "hsl(var(--gray-2-hsl))" },
    secondaryForeground: {
      label: "Secondary Foreground",
      value: "hsl(var(--gray-12-hsl))",
    },
    muted: { label: "Muted", value: "hsl(var(--gray-2-hsl))" },
    mutedForeground: {
      label: "Muted Foreground",
      value: "hsl(var(--gray-7-hsl))",
    },
    accent: { label: "Accent", value: "hsl(var(--gray-2-hsl))" },
    accentForeground: {
      label: "Accent Foreground",
      value: "hsl(var(--gray-12-hsl))",
    },
    destructive: { label: "Destructive", value: "hsl(var(--red-6-hsl))" },
    warning: { label: "Warning", value: "hsl(var(--yellow-6-hsl))" },
    warningForeground: {
      label: "Warning Foreground",
      value: "hsl(var(--gray-0-hsl))",
    },
    success: { label: "Success", value: "hsl(var(--green-6-hsl))" },
    successForeground: {
      label: "Success Foreground",
      value: "hsl(var(--gray-0-hsl))",
    },
    border: {
      label: "Border",
      value: "color-mix(in oklch, hsl(var(--gray-12-hsl)) 10%, transparent)",
    },
    input: {
      label: "Input",
      value: "color-mix(in oklch, hsl(var(--gray-12-hsl)) 15%, transparent)",
    },
    ring: { label: "Ring", value: "hsl(var(--blue-6-hsl))" },
  },

  typography: {
    body: { label: "Body Font", value: "var(--font-sans)" },
    heading: { label: "Heading Font", value: "var(--font-sans)" },
  },
}

/** Preset IDs the default theme is built on. Drives initial selection in UI. */
export const defaultActivePresetId = {
  colors: "blue",
  typography: "system-sans",
} as const

export const tokenToCssVar = (
  category: keyof TokenSchema,
  key: string
): string => {
  // Colours use the --theme- prefix so they don't collide with shadcn's
  // own variable names (--background, --primary, etc.).
  const prefixMap: Record<keyof TokenSchema, string> = {
    colors: "theme",
    typography: "font",
  }
  const prefix = prefixMap[category]
  const name = toKebab(key)
  return `--${prefix}-${name}`
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
