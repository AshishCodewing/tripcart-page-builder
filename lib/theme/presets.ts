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

// Backgrounds and foregrounds reference Open Props gray steps so they swap
// coherently with the rest of the palette. `--gray-0` is near-white (#f8f9fa),
// `--gray-12` is near-black (#030507); contrast on body text exceeds WCAG AAA.
const LIGHT_BG = "var(--gray-0)"
const LIGHT_FG = "var(--gray-12)"
const DARK_BG = "var(--gray-10)"
const DARK_FG = "var(--gray-0)"

export const COLOR_PRESETS: Preset[] = [
  buildColorPreset(
    "blue",
    "Blue",
    "var(--blue-6)",
    "var(--gray-0)",
    LIGHT_BG,
    LIGHT_FG
  ),
  buildColorPreset(
    "violet",
    "Violet",
    "var(--violet-6)",
    "var(--gray-0)",
    LIGHT_BG,
    LIGHT_FG
  ),
  // Open Props ships `pink` (no `rose`); pink-6 is the closest equivalent.
  buildColorPreset(
    "rose",
    "Rose",
    "var(--pink-6)",
    "var(--gray-0)",
    LIGHT_BG,
    LIGHT_FG
  ),
  // Open Props ships `teal` and `green` (no `emerald`); teal-6 reads as emerald.
  buildColorPreset(
    "emerald",
    "Emerald",
    "var(--teal-6)",
    "var(--gray-0)",
    LIGHT_BG,
    LIGHT_FG
  ),
  buildColorPreset(
    "orange",
    "Orange",
    "var(--orange-6)",
    "var(--gray-0)",
    LIGHT_BG,
    LIGHT_FG
  ),
  buildColorPreset(
    "zinc",
    "Zinc",
    "var(--gray-0)",
    "var(--gray-5)",
    DARK_BG,
    DARK_FG
  ),
]

export const TYPOGRAPHY_PRESETS: Preset[] = [
  {
    id: "system-sans",
    name: "System Sans",
    category: "typography",
    description: "Native UI sans-serif everywhere",
    tokens: {
      typography: {
        body: { label: "Body Font", value: "var(--font-sans)" },
        heading: { label: "Heading Font", value: "var(--font-sans)" },
      },
    },
  },
  {
    id: "editorial-serif",
    name: "Editorial Serif",
    category: "typography",
    description: "Serif headlines, sans body",
    tokens: {
      typography: {
        body: { label: "Body Font", value: "var(--font-sans)" },
        heading: { label: "Heading Font", value: "var(--font-serif)" },
      },
    },
  },
  {
    id: "monospace",
    name: "Monospace",
    category: "typography",
    description: "Technical, code-driven look",
    tokens: {
      typography: {
        body: { label: "Body Font", value: "var(--font-mono)" },
        heading: { label: "Heading Font", value: "var(--font-mono)" },
      },
    },
  },
  {
    id: "system-ui",
    name: "System UI",
    category: "typography",
    description: "Native OS interface font",
    tokens: {
      typography: {
        body: { label: "Body Font", value: "var(--font-system-ui)" },
        heading: { label: "Heading Font", value: "var(--font-system-ui)" },
      },
    },
  },
  {
    id: "transitional",
    name: "Transitional",
    category: "typography",
    description: "Charter-led editorial serif",
    tokens: {
      typography: {
        body: {
          label: "Body Font",
          value: "var(--font-transitional)",
        },
        heading: {
          label: "Heading Font",
          value: "var(--font-transitional)",
        },
      },
    },
  },
  {
    id: "old-style",
    name: "Old Style",
    category: "typography",
    description: "Classic Iowan / Palatino serif",
    tokens: {
      typography: {
        body: { label: "Body Font", value: "var(--font-old-style)" },
        heading: { label: "Heading Font", value: "var(--font-old-style)" },
      },
    },
  },
  {
    id: "humanist",
    name: "Humanist",
    category: "typography",
    description: "Warm Seravek / Gill Sans",
    tokens: {
      typography: {
        body: { label: "Body Font", value: "var(--font-humanist)" },
        heading: { label: "Heading Font", value: "var(--font-humanist)" },
      },
    },
  },
  {
    id: "geometric-humanist",
    name: "Geometric Humanist",
    category: "typography",
    description: "Avenir / Montserrat geometry",
    tokens: {
      typography: {
        body: {
          label: "Body Font",
          value: "var(--font-geometric-humanist)",
        },
        heading: {
          label: "Heading Font",
          value: "var(--font-geometric-humanist)",
        },
      },
    },
  },
  {
    id: "classical-humanist",
    name: "Classical Humanist",
    category: "typography",
    description: "Optima / Candara elegance",
    tokens: {
      typography: {
        body: {
          label: "Body Font",
          value: "var(--font-classical-humanist)",
        },
        heading: {
          label: "Heading Font",
          value: "var(--font-classical-humanist)",
        },
      },
    },
  },
  {
    id: "neo-grotesque",
    name: "Neo-Grotesque",
    category: "typography",
    description: "Inter / Helvetica precision",
    tokens: {
      typography: {
        body: {
          label: "Body Font",
          value: "var(--font-neo-grotesque)",
        },
        heading: {
          label: "Heading Font",
          value: "var(--font-neo-grotesque)",
        },
      },
    },
  },
  {
    id: "monospace-slab-serif",
    name: "Monospace Slab",
    category: "typography",
    description: "Typewriter-style monospace",
    tokens: {
      typography: {
        body: {
          label: "Body Font",
          value: "var(--font-monospace-slab-serif)",
        },
        heading: {
          label: "Heading Font",
          value: "var(--font-monospace-slab-serif)",
        },
      },
    },
  },
  {
    id: "monospace-code",
    name: "Monospace Code",
    category: "typography",
    description: "Developer-grade monospace",
    tokens: {
      typography: {
        body: {
          label: "Body Font",
          value: "var(--font-monospace-code)",
        },
        heading: {
          label: "Heading Font",
          value: "var(--font-monospace-code)",
        },
      },
    },
  },
  {
    id: "industrial",
    name: "Industrial",
    category: "typography",
    description: "Bahnschrift / DIN engineering",
    tokens: {
      typography: {
        body: { label: "Body Font", value: "var(--font-industrial)" },
        heading: { label: "Heading Font", value: "var(--font-industrial)" },
      },
    },
  },
  {
    id: "rounded-sans",
    name: "Rounded Sans",
    category: "typography",
    description: "Soft, friendly Quicksand",
    tokens: {
      typography: {
        body: {
          label: "Body Font",
          value: "var(--font-rounded-sans)",
        },
        heading: {
          label: "Heading Font",
          value: "var(--font-rounded-sans)",
        },
      },
    },
  },
  {
    id: "slab-serif",
    name: "Slab Serif",
    category: "typography",
    description: "Bold Rockwell impact",
    tokens: {
      typography: {
        body: { label: "Body Font", value: "var(--font-slab-serif)" },
        heading: { label: "Heading Font", value: "var(--font-slab-serif)" },
      },
    },
  },
  {
    id: "antique",
    name: "Antique",
    category: "typography",
    description: "Bookman editorial warmth",
    tokens: {
      typography: {
        body: { label: "Body Font", value: "var(--font-antique)" },
        heading: { label: "Heading Font", value: "var(--font-antique)" },
      },
    },
  },
  {
    id: "didone",
    name: "Didone",
    category: "typography",
    description: "High-fashion Didot / Bodoni",
    tokens: {
      typography: {
        body: { label: "Body Font", value: "var(--font-didone)" },
        heading: { label: "Heading Font", value: "var(--font-didone)" },
      },
    },
  },
  {
    id: "handwritten",
    name: "Handwritten",
    category: "typography",
    description: "Casual Bradley Hand cursive",
    tokens: {
      typography: {
        body: {
          label: "Body Font",
          value: "var(--font-handwritten)",
        },
        heading: {
          label: "Heading Font",
          value: "var(--font-handwritten)",
        },
      },
    },
  },
]

export const ALL_PRESETS: Preset[] = [...COLOR_PRESETS, ...TYPOGRAPHY_PRESETS]
