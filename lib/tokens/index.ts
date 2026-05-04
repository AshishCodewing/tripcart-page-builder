/**
 * Source of truth for all Tripcart brand design tokens.
 * Default values intentionally reference Open Props variables so the desing system has a well-considered baseline out of the box
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
    background: { label: "Background", value: "oklch(0.145 0 0)" },
    foreground: { label: "Foreground", value: "oklch(0.985 0 0)" },
    card: { label: "Card", value: "oklch(0.205 0 0)" },
    cardForeground: { label: "Card Foreground", value: "oklch(0.985 0 0)" },
    popover: { label: "Popover", value: "oklch(0.205 0 0)" },
    popoverForeground: {
      label: "Popover Foreground",
      value: "oklch(0.985 0 0)",
    },
    primary: { label: "Primary", value: "oklch(0.631 0.2 257.6)" },
    primaryForeground: { label: "Primary Foreground", value: "oklch(1 0 0)" },
    secondary: { label: "Secondary", value: "oklch(0.269 0 0)" },
    secondaryForeground: {
      label: "Secondary Foreground",
      value: "oklch(0.985 0 0)",
    },
    muted: { label: "Muted", value: "oklch(0.269 0 0)" },
    mutedForeground: { label: "Muted Foreground", value: "oklch(0.708 0 0)" },
    accent: { label: "Accent", value: "oklch(0.269 0 0)" },
    accentForeground: { label: "Accent Foreground", value: "oklch(0.985 0 0)" },
    border: { label: "Border", value: "oklch(1 0 0 / 10%)" },
    input: { label: "Input", value: "oklch(1 0 0 / 15%)" },
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
