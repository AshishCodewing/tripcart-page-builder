// lib/tokens/tokens.ts
//
// Source of truth for all Tripcart brand design tokens.
// Default values intentionally reference Open Props variables so the
// design system has a well-considered baseline out of the box.

export type TokenValue = {
    label: string
    value: string
  }
  
  export type TokenSchema = {
    colors:     Record<string, TokenValue>
    typography: Record<string, TokenValue>
    spacing:    Record<string, TokenValue>
    radii:      Record<string, TokenValue>
    shadows:    Record<string, TokenValue>
  }
  
  export const defaultTokens: TokenSchema = {
    // ── Colors (shadcn / Tailwind dark theme) ─────────────────────────────────
    // Emitted as bare CSS variables (--background, --primary, etc.) to match
    // the shadcn/ui convention. Values are oklch() so we get perceptually
    // even colour scales and proper alpha support out of the box.
    colors: {
      background:          { label: 'Background',           value: 'oklch(0.145 0 0)'         },
      foreground:          { label: 'Foreground',           value: 'oklch(0.985 0 0)'         },
      card:                { label: 'Card',                 value: 'oklch(0.205 0 0)'         },
      cardForeground:      { label: 'Card Foreground',      value: 'oklch(0.985 0 0)'         },
      popover:             { label: 'Popover',              value: 'oklch(0.205 0 0)'         },
      popoverForeground:   { label: 'Popover Foreground',   value: 'oklch(0.985 0 0)'         },
      primary:             { label: 'Primary',              value: 'oklch(0.631 0.2 257.6)'   },
      primaryForeground:   { label: 'Primary Foreground',   value: 'oklch(1 0 0)'             },
      secondary:           { label: 'Secondary',            value: 'oklch(0.269 0 0)'         },
      secondaryForeground: { label: 'Secondary Foreground', value: 'oklch(0.985 0 0)'         },
      muted:               { label: 'Muted',                value: 'oklch(0.269 0 0)'         },
      mutedForeground:     { label: 'Muted Foreground',     value: 'oklch(0.708 0 0)'         },
      accent:              { label: 'Accent',               value: 'oklch(0.269 0 0)'         },
      accentForeground:    { label: 'Accent Foreground',    value: 'oklch(0.985 0 0)'         },
      border:              { label: 'Border',               value: 'oklch(1 0 0 / 10%)'       },
      input:               { label: 'Input',                value: 'oklch(1 0 0 / 15%)'       },
      ring:                { label: 'Ring',                 value: 'oklch(0.556 0 0)'         },
    },
  
    // ── Typography ────────────────────────────────────────────────────────────
    typography: {
      fontPrimary:  { label: 'Primary Font',  value: 'var(--font-sans)'  },
      fontDisplay:  { label: 'Display Font',  value: 'var(--font-sans)'  },
      fontMono:     { label: 'Mono Font',     value: 'var(--font-mono)'  },
  
      sizeXs:  { label: 'XS',  value: 'var(--font-size-0)' },
      sizeSm:  { label: 'SM',  value: 'var(--font-size-1)' },
      sizeMd:  { label: 'MD',  value: 'var(--font-size-2)' },
      sizeLg:  { label: 'LG',  value: 'var(--font-size-3)' },
      sizeXl:  { label: 'XL',  value: 'var(--font-size-4)' },
      size2xl: { label: '2XL', value: 'var(--font-size-5)' },
      size3xl: { label: '3XL', value: 'var(--font-size-6)' },
      size4xl: { label: '4XL', value: 'var(--font-size-7)' },
      size5xl: { label: '5XL', value: 'var(--font-size-8)' },
  
      sizeFluid1: { label: 'Fluid 1', value: 'var(--font-size-fluid-1)' },
      sizeFluid2: { label: 'Fluid 2', value: 'var(--font-size-fluid-2)' },
      sizeFluid3: { label: 'Fluid 3', value: 'var(--font-size-fluid-3)' },
  
      weightLight:  { label: 'Light 300',   value: 'var(--font-weight-3)' },
      weightNormal: { label: 'Regular 400', value: 'var(--font-weight-4)' },
      weightMedium: { label: 'Medium 500',  value: 'var(--font-weight-5)' },
      weightSemi:   { label: 'Semi 600',    value: 'var(--font-weight-6)' },
      weightBold:   { label: 'Bold 700',    value: 'var(--font-weight-7)' },
      weightBlack:  { label: 'Black 900',   value: 'var(--font-weight-9)' },
  
      lineHeightTight:   { label: 'Tight',   value: 'var(--font-lineheight-1)' },
      lineHeightNormal:  { label: 'Normal',  value: 'var(--font-lineheight-3)' },
      lineHeightRelaxed: { label: 'Relaxed', value: 'var(--font-lineheight-4)' },
      lineHeightLoose:   { label: 'Loose',   value: 'var(--font-lineheight-5)' },
    },
  
    // ── Spacing ───────────────────────────────────────────────────────────────
    spacing: {
      xs:      { label: 'XS (4px)',   value: 'var(--size-1)'       },
      sm:      { label: 'SM (8px)',   value: 'var(--size-2)'       },
      md:      { label: 'MD (16px)',  value: 'var(--size-4)'       },
      lg:      { label: 'LG (24px)',  value: 'var(--size-6)'       },
      xl:      { label: 'XL (32px)',  value: 'var(--size-8)'       },
      '2xl':   { label: '2XL (48px)', value: 'var(--size-10)'      },
      '3xl':   { label: '3XL (64px)', value: 'var(--size-12)'      },
      section: { label: 'Section',    value: 'var(--size-fluid-5)' },
    },
  
    // ── Radii ─────────────────────────────────────────────────────────────────
    radii: {
      none: { label: 'None', value: '0'                   },
      sm:   { label: 'SM',   value: 'var(--radius-1)'     },
      md:   { label: 'MD',   value: 'var(--radius-2)'     },
      lg:   { label: 'LG',   value: 'var(--radius-3)'     },
      xl:   { label: 'XL',   value: 'var(--radius-4)'     },
      full: { label: 'Full', value: 'var(--radius-round)' },
      blob: { label: 'Blob', value: 'var(--radius-blob-1)'},
    },
  
    // ── Shadows ───────────────────────────────────────────────────────────────
    shadows: {
      none: { label: 'None', value: 'none'            },
      xs:   { label: 'XS',   value: 'var(--shadow-1)' },
      sm:   { label: 'SM',   value: 'var(--shadow-2)' },
      md:   { label: 'MD',   value: 'var(--shadow-3)' },
      lg:   { label: 'LG',   value: 'var(--shadow-4)' },
      xl:   { label: 'XL',   value: 'var(--shadow-5)' },
      '2xl':{ label: '2XL',  value: 'var(--shadow-6)' },
    },
  }
  
  // ── CSS variable name helpers ────────────────────────────────────────────────
  
  export const toKebab = (str: string): string =>
    str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
  
  export const tokenToCssVar = (category: keyof TokenSchema, key: string): string => {
    // Colours follow the shadcn convention — no prefix (--background,
    // --primary, --card-foreground, etc.). Other categories keep their
    // namespace prefix so they don't collide with Open Props or shadcn.
    const prefixMap: Record<keyof TokenSchema, string | null> = {
      colors:     null,
      typography: 'font',
      spacing:    'spacing',
      radii:      'radius',
      shadows:    'shadow',
    }
    const prefix = prefixMap[category]
    const name   = toKebab(key)
    return prefix ? `--${prefix}-${name}` : `--${name}`
  }
  
  export const tokensToStylesObject = (tokens: TokenSchema): Record<string, string> => {
    const styles: Record<string, string> = {}
    for (const [category, group] of Object.entries(tokens)) {
      for (const [key, token] of Object.entries(group)) {
        styles[tokenToCssVar(category as keyof TokenSchema, key)] = token.value
      }
    }
    return styles
  }
  