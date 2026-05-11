/**
 * Built-in presets - collections of token overrides that swap a category ( or a slice of one ) in a single click. Pick a palette, get a coordinated brand identity.
 * A preset only specifies the tokens it cares about. Everything else on the active theme is preserved when the preset is applied.
 */

import type { TokenSchema, TokenValue } from "@/lib/tokens"

export type PresetCategory = "colors" | "typography"

export type Preset = {
  id: string
  name: string
  category: PresetCategory
  description?: string
  /** Subset of tokens to merge into the active theme. */
  tokens: Partial<{
    [K in keyof TokenSchema]: Partial<Record<string, TokenValue>>
  }>
  /** Three accent swatches for the preset card. */
  swatches?: [string, string, string, string]
}

const buildColorPreset = (
  id: string,
  name: string,
  primary: string,
  primaryForeground: string,
  background: string,
  foreground: string
): Preset => ({
  id,
  name,
  category: "colors",
  swatches: [primary, primaryForeground, background, foreground],
  tokens: {
    colors: {
      primary: { label: "Primary", value: primary },
      primaryForeground: {
        label: "Primary Foreground",
        value: primaryForeground,
      },
      background: { label: "Background", value: background },
      foreground: { label: "Foreground", value: foreground },
    },
  },
})

const LIGHT_BG = "hsl(var(--gray-0-hsl))"
const LIGHT_FG = "hsl(var(--gray-12-hsl))"
const DARK_BG = "hsl(var(--gray-10-hsl))"
const DARK_FG = "hsl(var(--gray-0-hsl))"

export const COLOR_PRESETS: Preset[] = [
  buildColorPreset(
    "blue",
    "Blue",
    "hsl(var(--blue-6-hsl))",
    "hsl(var(--gray-0-hsl))",
    LIGHT_BG,
    LIGHT_FG
  ),
  buildColorPreset(
    "violet",
    "Violet",
    "hsl(var(--violet-6-hsl))",
    "hsl(var(--gray-0-hsl))",
    LIGHT_BG,
    LIGHT_FG
  ),
  // Open Props ships `pink` (no `rose`); pink-6 is the closest equivalent.
  buildColorPreset(
    "rose",
    "Rose",
    "hsl(var(--pink-6-hsl))",
    "hsl(var(--gray-0-hsl))",
    LIGHT_BG,
    LIGHT_FG
  ),
  // Open Props ships `teal` and `green` (no `emerald`); teal-6 reads as emerald.
  buildColorPreset(
    "emerald",
    "Emerald",
    "hsl(var(--teal-6-hsl))",
    "hsl(var(--gray-0-hsl))",
    LIGHT_BG,
    LIGHT_FG
  ),
  buildColorPreset(
    "orange",
    "Orange",
    "hsl(var(--orange-6-hsl))",
    "hsl(var(--gray-0-hsl))",
    LIGHT_BG,
    LIGHT_FG
  ),
  buildColorPreset(
    "zinc",
    "Zinc",
    "hsl(var(--gray-0-hsl))",
    "hsl(var(--gray-5-hsl))",
    DARK_BG,
    DARK_FG
  ),
]

/**
 * Typography presets pair a heading font with a body font. Each pairing is
 * picked for tonal coherence (display weight + reading texture) rather than
 * variety alone. `system-sans` is the default (see `defaultActivePresetId`).
 */
const buildTypographyPreset = (
  id: string,
  name: string,
  description: string,
  heading: string,
  body: string
): Preset => ({
  id,
  name,
  category: "typography",
  description,
  tokens: {
    typography: {
      heading: { label: "Heading Font", value: heading },
      body: { label: "Body Font", value: body },
    },
  },
})

export const TYPOGRAPHY_PRESETS: Preset[] = [
  buildTypographyPreset(
    "system-sans",
    "System Sans",
    "Native UI sans throughout",
    "var(--font-sans)",
    "var(--font-sans)"
  ),
  buildTypographyPreset(
    "modern-sans",
    "Modern Sans",
    "Inter / Helvetica precision",
    "var(--font-neo-grotesque)",
    "var(--font-neo-grotesque)"
  ),
  buildTypographyPreset(
    "editorial-display",
    "Editorial Display",
    "Didot headlines, Iowan body",
    "var(--font-didone)",
    "var(--font-old-style)"
  ),
  buildTypographyPreset(
    "classic-book",
    "Classic Book",
    "Literary Iowan throughout",
    "var(--font-old-style)",
    "var(--font-old-style)"
  ),
  buildTypographyPreset(
    "slab-and-humanist",
    "Slab & Humanist",
    "Rockwell heads, Avenir body",
    "var(--font-slab-serif)",
    "var(--font-geometric-humanist)"
  ),
  buildTypographyPreset(
    "neo-and-mono-slab",
    "Neo & Mono Slab",
    "Inter heads, Courier body",
    "var(--font-neo-grotesque)",
    "var(--font-monospace-slab-serif)"
  ),
  buildTypographyPreset(
    "mono-terminal",
    "Mono Terminal",
    "Code heads, neutral sans body",
    "var(--font-monospace-code)",
    "var(--font-neo-grotesque)"
  ),
  buildTypographyPreset(
    "brutalist-mono",
    "Brutalist Mono",
    "Courier slab end-to-end",
    "var(--font-monospace-slab-serif)",
    "var(--font-monospace-slab-serif)"
  ),
  buildTypographyPreset(
    "industrial-engineer",
    "Industrial",
    "Bahnschrift heads, Inter body",
    "var(--font-industrial)",
    "var(--font-neo-grotesque)"
  ),
  buildTypographyPreset(
    "rounded-friendly",
    "Rounded & Warm",
    "Quicksand heads, Seravek body",
    "var(--font-rounded-sans)",
    "var(--font-humanist)"
  ),
  buildTypographyPreset(
    "didone-fashion",
    "Didone Fashion",
    "Didot heads, Charter body",
    "var(--font-didone)",
    "var(--font-transitional)"
  ),
  buildTypographyPreset(
    "optima-classical",
    "Classical",
    "Optima heads, Iowan body",
    "var(--font-classical-humanist)",
    "var(--font-old-style)"
  ),
  buildTypographyPreset(
    "antique-editorial",
    "Antique",
    "Bookman editorial warmth",
    "var(--font-antique)",
    "var(--font-antique)"
  ),
  buildTypographyPreset(
    "handwritten-personal",
    "Handwritten",
    "Bradley heads, Iowan body",
    "var(--font-handwritten)",
    "var(--font-old-style)"
  ),
]

export const ALL_PRESETS: Preset[] = [...COLOR_PRESETS, ...TYPOGRAPHY_PRESETS]
