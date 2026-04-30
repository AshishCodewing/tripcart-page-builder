  /**
 * Source of truth for all Tripcart brand design tokens.
 * Default values intentionally reference Open Props variables so the desing system has a well-considered baseline out of the box
 */

export type TokenValue = {
  label: string
  value: string
}

export type TokenSchema = {
  colors    : Record<string, TokenValue>
  typography: Record<string, TokenValue>
}

export const defaultTokens: TokenSchema = {
  colors: {
    background         : { label: 'Background',           value: 'oklch(0.145 0 0)'         },
    foreground         : { label: 'Foreground',           value: 'oklch(0.985 0 0)'         },
    card               : { label: 'Card',                 value: 'oklch(0.205 0 0)'         },
    cardForeground     : { label: 'Card Foreground',      value: 'oklch(0.985 0 0)'         },
    popover            : { label: 'Popover',              value: 'oklch(0.205 0 0)'         },
    popoverForeground  : { label: 'Popover Foreground',   value: 'oklch(0.985 0 0)'         },
    primary            : { label: 'Primary',              value: 'oklch(0.631 0.2 257.6)'   },
    primaryForeground  : { label: 'Primary Foreground',   value: 'oklch(1 0 0)'             },
    secondary          : { label: 'Secondary',            value: 'oklch(0.269 0 0)'         },
    secondaryForeground: { label: 'Secondary Foreground', value: 'oklch(0.985 0 0)'         },
    muted              : { label: 'Muted',                value: 'oklch(0.269 0 0)'         },
    mutedForeground    : { label: 'Muted Foreground',     value: 'oklch(0.708 0 0)'         },
    accent             : { label: 'Accent',               value: 'oklch(0.269 0 0)'         },
    accentForeground   : { label: 'Accent Foreground',    value: 'oklch(0.985 0 0)'         },
    border             : { label: 'Border',               value: 'oklch(1 0 0 / 10%)'       },
    input              : { label: 'Input',                value: 'oklch(1 0 0 / 15%)'       },
  },

  typography: {
    fontPrimary: { label: 'Primary Font',  value: 'var(--font-sans)'  },
    fontDisplay: { label: 'Display Font',  value: 'var(--font-sans)'  },
    fontMono   : { label: 'Mono Font',     value: 'var(--font-mono)'  },
  }
}