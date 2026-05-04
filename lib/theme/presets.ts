/**
 * Built-in presets - collections of token overrides that swap a category ( or a slice of one ) in a single click. Pick a palette, get a coordinated brand identity.
 * A preset only specifies the tokens it cares about. Everything else on the active theme is preserved when the preset is applied.
 */

import type { TokenSchema, TokenValue} from "@/lib/tokens"

export type PresetCategory = 'colors' | 'typography'

export type Preset = {
  id:          string
  name:        string
  category:    PresetCategory
  description?: string
  /** Subset of tokens to merge into the active theme. */
  tokens: Partial<{
    [K in keyof TokenSchema]: Partial<Record<string, TokenValue>>
  }>
  /** Three accent swatches for the preset card. */
  swatches?: [string, string, string, string]
}

const buildColorPreset = (
  id               : string,
  name             : string,
  primary          : string,
  primaryForeground: string,
  background       : string,
  foreground       : string,
): Preset => ({
  id,
  name,
  category: 'colors',
  swatches: [primary, primaryForeground, background, foreground],
  tokens  : {
    colors: {
      primary          : { label: 'Primary',            value: primary           },
      primaryForeground: { label: 'Primary Foreground', value: primaryForeground },
      background       : { label: 'Background',         value: background        },
      foreground       : { label: 'Foreground',         value: foreground        },
    },
  },
})

// Background / foreground pairs are tuned for WCAG AAA (>= 7:1) on body text.
// Light presets : oklch(1 0 0) bg + oklch(0.145 0 0) fg  -> ~17.6:1
// Dark zinc     : oklch(0.205 0 0) bg + oklch(0.985 0 0) fg -> ~13.4:1
const LIGHT_BG = 'oklch(1 0 0)'
const LIGHT_FG = 'oklch(0.145 0 0)'
const DARK_BG  = 'oklch(0.205 0 0)'
const DARK_FG  = 'oklch(0.985 0 0)'

export const COLOR_PRESETS: Preset[] = [
  buildColorPreset('blue',    'Blue',    'oklch(0.631 0.2 257.6)',   'oklch(0.556 0 0)',         LIGHT_BG, LIGHT_FG),
  buildColorPreset('violet',  'Violet',  'oklch(0.606 0.25 292.7)',  'oklch(0.541 0.225 292.7)', LIGHT_BG, LIGHT_FG),
  buildColorPreset('rose',    'Rose',    'oklch(0.645 0.246 16.4)',  'oklch(0.586 0.225 16.4)',  LIGHT_BG, LIGHT_FG),
  buildColorPreset('emerald', 'Emerald', 'oklch(0.696 0.17 162.5)',  'oklch(0.62 0.155 162.5)',  LIGHT_BG, LIGHT_FG),
  buildColorPreset('orange',  'Orange',  'oklch(0.705 0.19 56.1)',   'oklch(0.625 0.18 56.1)',   LIGHT_BG, LIGHT_FG),
  buildColorPreset('zinc',    'Zinc',    'oklch(0.985 0 0)',         'oklch(0.708 0 0)',         DARK_BG,  DARK_FG ),
]

export const TYPOGRAPHY_PRESETS: Preset[] = [
  {
    id:          'system-sans',
    name:        'System Sans',
    category:    'typography',
    description: 'Native UI sans-serif everywhere',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-sans)' },
        fontDisplay: { label: 'Display Font', value: 'var(--font-sans)' },
      },
    },
  },
  {
    id:          'editorial-serif',
    name:        'Editorial Serif',
    category:    'typography',
    description: 'Serif headlines, sans body',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-sans)'  },
        fontDisplay: { label: 'Display Font', value: 'var(--font-serif)' },
      },
    },
  },
  {
    id:          'monospace',
    name:        'Monospace',
    category:    'typography',
    description: 'Technical, code-driven look',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-mono)' },
        fontDisplay: { label: 'Display Font', value: 'var(--font-mono)' },
      },
    },
  },
  {
    id:          'system-ui',
    name:        'System UI',
    category:    'typography',
    description: 'Native OS interface font',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-system-ui)' },
        fontDisplay: { label: 'Display Font', value: 'var(--font-system-ui)' },
      },
    },
  },
  {
    id:          'transitional',
    name:        'Transitional',
    category:    'typography',
    description: 'Charter-led editorial serif',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-transitional)' },
        fontDisplay: { label: 'Display Font', value: 'var(--font-transitional)' },
      },
    },
  },
  {
    id:          'old-style',
    name:        'Old Style',
    category:    'typography',
    description: 'Classic Iowan / Palatino serif',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-old-style)' },
        fontDisplay: { label: 'Display Font', value: 'var(--font-old-style)' },
      },
    },
  },
  {
    id:          'humanist',
    name:        'Humanist',
    category:    'typography',
    description: 'Warm Seravek / Gill Sans',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-humanist)' },
        fontDisplay: { label: 'Display Font', value: 'var(--font-humanist)' },
      },
    },
  },
  {
    id:          'geometric-humanist',
    name:        'Geometric Humanist',
    category:    'typography',
    description: 'Avenir / Montserrat geometry',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-geometric-humanist)' },
        fontDisplay: { label: 'Display Font', value: 'var(--font-geometric-humanist)' },
      },
    },
  },
  {
    id:          'classical-humanist',
    name:        'Classical Humanist',
    category:    'typography',
    description: 'Optima / Candara elegance',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-classical-humanist)' },
        fontDisplay: { label: 'Display Font', value: 'var(--font-classical-humanist)' },
      },
    },
  },
  {
    id:          'neo-grotesque',
    name:        'Neo-Grotesque',
    category:    'typography',
    description: 'Inter / Helvetica precision',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-neo-grotesque)' },
        fontDisplay: { label: 'Display Font', value: 'var(--font-neo-grotesque)' },
      },
    },
  },
  {
    id:          'monospace-slab-serif',
    name:        'Monospace Slab',
    category:    'typography',
    description: 'Typewriter-style monospace',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-monospace-slab-serif)' },
        fontDisplay: { label: 'Display Font', value: 'var(--font-monospace-slab-serif)' },
      },
    },
  },
  {
    id:          'monospace-code',
    name:        'Monospace Code',
    category:    'typography',
    description: 'Developer-grade monospace',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-monospace-code)' },
        fontDisplay: { label: 'Display Font', value: 'var(--font-monospace-code)' },
      },
    },
  },
  {
    id:          'industrial',
    name:        'Industrial',
    category:    'typography',
    description: 'Bahnschrift / DIN engineering',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-industrial)' },
        fontDisplay: { label: 'Display Font', value: 'var(--font-industrial)' },
      },
    },
  },
  {
    id:          'rounded-sans',
    name:        'Rounded Sans',
    category:    'typography',
    description: 'Soft, friendly Quicksand',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-rounded-sans)' },
        fontDisplay: { label: 'Display Font', value: 'var(--font-rounded-sans)' },
      },
    },
  },
  {
    id:          'slab-serif',
    name:        'Slab Serif',
    category:    'typography',
    description: 'Bold Rockwell impact',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-slab-serif)' },
        fontDisplay: { label: 'Display Font', value: 'var(--font-slab-serif)' },
      },
    },
  },
  {
    id:          'antique',
    name:        'Antique',
    category:    'typography',
    description: 'Bookman editorial warmth',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-antique)' },
        fontDisplay: { label: 'Display Font', value: 'var(--font-antique)' },
      },
    },
  },
  {
    id:          'didone',
    name:        'Didone',
    category:    'typography',
    description: 'High-fashion Didot / Bodoni',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-didone)' },
        fontDisplay: { label: 'Display Font', value: 'var(--font-didone)' },
      },
    },
  },
  {
    id:          'handwritten',
    name:        'Handwritten',
    category:    'typography',
    description: 'Casual Bradley Hand cursive',
    tokens: {
      typography: {
        fontPrimary: { label: 'Primary Font', value: 'var(--font-handwritten)' },
        fontDisplay: { label: 'Display Font', value: 'var(--font-handwritten)' },
      },
    },
  },
]

export const ALL_PRESETS: Preset[] = [...COLOR_PRESETS, ...TYPOGRAPHY_PRESETS]
