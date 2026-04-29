// lib/theme/presets.ts
//
// Built-in presets — collections of token overrides that swap a category
// (or a slice of one) in a single click. Designed to be Gutenberg-style:
// pick a palette, get a coordinated brand identity.
//
// A preset only specifies the tokens it cares about. Everything else on
// the active theme is preserved when the preset is applied.

import type { TokenSchema, TokenValue } from '@/lib/tokens'

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
  swatches?: [string, string, string]
}

// ── Color presets ─────────────────────────────────────────────────────────────
//
// Shadcn-style: each preset swaps the saturated tokens (primary, primary-
// foreground, ring) and leaves neutrals alone. Hue varies; lightness and
// chroma stay near shadcn defaults so contrast remains predictable.

const buildColorPreset = (
  id:    string,
  name:  string,
  primary: string,
  ring:    string,
  primaryForeground = 'oklch(1 0 0)',
): Preset => ({
  id,
  name,
  category: 'colors',
  swatches: [primary, ring, primaryForeground],
  tokens: {
    colors: {
      primary:           { label: 'Primary',            value: primary           },
      primaryForeground: { label: 'Primary Foreground', value: primaryForeground },
      ring:              { label: 'Ring',               value: ring              },
    },
  },
})

export const COLOR_PRESETS: Preset[] = [
  buildColorPreset('blue',   'Blue',   'oklch(0.631 0.2 257.6)', 'oklch(0.556 0 0)'),
  buildColorPreset('violet', 'Violet', 'oklch(0.606 0.25 292.7)', 'oklch(0.541 0.225 292.7)'),
  buildColorPreset('rose',   'Rose',   'oklch(0.645 0.246 16.4)',  'oklch(0.586 0.225 16.4)'),
  buildColorPreset('emerald','Emerald','oklch(0.696 0.17 162.5)',  'oklch(0.62 0.155 162.5)'),
  buildColorPreset('orange', 'Orange', 'oklch(0.705 0.19 56.1)',   'oklch(0.625 0.18 56.1)'),
  buildColorPreset('zinc',   'Zinc',   'oklch(0.985 0 0)', 'oklch(0.708 0 0)', 'oklch(0.205 0 0)'),
]

// ── Typography presets ────────────────────────────────────────────────────────

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
]

export const ALL_PRESETS: Preset[] = [...COLOR_PRESETS, ...TYPOGRAPHY_PRESETS]
