// Declarative map from a PresetCategory to where its token array lives in the
// Theme settings tree. Replaces the parallel getGroup/withGroup switches.
//
// Each `set` rebuilds ONLY the touched branch and shares references for every
// untouched subtree (e.g. editing colors leaves `settings.typography`
// referentially identical), which is what keeps theme selectors from
// re-firing on unrelated changes. Preserve that when editing this file.

import type { PresetCategory } from "@/lib/theme/compile"
import type { FontSizeToken, Theme, Token } from "@/lib/theme/schema"

type PathDef = {
  get: (theme: Theme) => Token[] | undefined
  set: (theme: Theme, tokens: Token[]) => Theme
}

export const tokenPaths = {
  color: {
    get: (t) => t.settings.color?.palette,
    set: (t, tokens) => ({
      ...t,
      settings: {
        ...t.settings,
        color: { ...t.settings.color, palette: tokens },
      },
    }),
  },
  "font-family": {
    get: (t) => t.settings.typography?.fontFamilies,
    set: (t, tokens) => ({
      ...t,
      settings: {
        ...t.settings,
        typography: { ...t.settings.typography, fontFamilies: tokens },
      },
    }),
  },
  "font-size": {
    get: (t) => t.settings.typography?.fontSizes,
    set: (t, tokens) => ({
      ...t,
      settings: {
        ...t.settings,
        typography: {
          ...t.settings.typography,
          fontSizes: tokens as FontSizeToken[],
        },
      },
    }),
  },
  "font-weight": {
    get: (t) => t.settings.typography?.fontWeights,
    set: (t, tokens) => ({
      ...t,
      settings: {
        ...t.settings,
        typography: { ...t.settings.typography, fontWeights: tokens },
      },
    }),
  },
  "line-height": {
    get: (t) => t.settings.typography?.lineHeights,
    set: (t, tokens) => ({
      ...t,
      settings: {
        ...t.settings,
        typography: { ...t.settings.typography, lineHeights: tokens },
      },
    }),
  },
  "letter-spacing": {
    get: (t) => t.settings.typography?.letterSpacings,
    set: (t, tokens) => ({
      ...t,
      settings: {
        ...t.settings,
        typography: { ...t.settings.typography, letterSpacings: tokens },
      },
    }),
  },
  spacing: {
    get: (t) => t.settings.spacing?.sizes,
    set: (t, tokens) => ({
      ...t,
      settings: {
        ...t.settings,
        spacing: { ...t.settings.spacing, sizes: tokens },
      },
    }),
  },
  radius: {
    get: (t) => t.settings.border?.radii,
    set: (t, tokens) => ({
      ...t,
      settings: {
        ...t.settings,
        border: { ...t.settings.border, radii: tokens },
      },
    }),
  },
  "border-width": {
    get: (t) => t.settings.border?.widths,
    set: (t, tokens) => ({
      ...t,
      settings: {
        ...t.settings,
        border: { ...t.settings.border, widths: tokens },
      },
    }),
  },
  "border-style": {
    get: (t) => t.settings.border?.styles,
    set: (t, tokens) => ({
      ...t,
      settings: {
        ...t.settings,
        border: { ...t.settings.border, styles: tokens },
      },
    }),
  },
  shadow: {
    get: (t) => t.settings.shadow?.presets,
    set: (t, tokens) => ({
      ...t,
      settings: {
        ...t.settings,
        shadow: { ...t.settings.shadow, presets: tokens },
      },
    }),
  },
} satisfies Record<PresetCategory, PathDef>

export const getGroup = (
  theme: Theme,
  category: PresetCategory
): Token[] | undefined => tokenPaths[category].get(theme)

export const withGroup = (
  theme: Theme,
  category: PresetCategory,
  tokens: Token[]
): Theme => tokenPaths[category].set(theme, tokens)
