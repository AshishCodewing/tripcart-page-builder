/**
 * Source of truth for Tripcart's bundled brand defaults.
 *
 * The defaults reference Open Props variables (https://open-props.style)
 * so the design system has a well-considered baseline. Open Props is
 * loaded into the GrapesJS canvas iframe via `canvas.styles` in
 * editor-shell; any environment that renders authored content must also
 * load Open Props for these `var(...)` references to resolve.
 *
 * Shape mirrors WordPress `theme.json`:
 *   - `defaultTheme.settings` is the *registry* of design tokens.
 *   - `defaultTheme.styles`   is reserved for default style application
 *     (root, per-element, per-component). Empty in this PR; populated
 *     in the styles-application follow-up.
 *
 * `tokensFromStored` rehydrates a `Theme` from a persisted `:root` style
 * object by reading the canonical `--tc--preset--*` names. Tokens absent
 * from the stored rule keep their default value.
 */

import { presetVarName, type PresetCategory } from "@/lib/theme/compile"
import type {
  ColorToken,
  FontSizeToken,
  Theme,
  Token,
} from "@/lib/theme/schema"

export type ActivePresetId = Partial<Record<PresetCategory, string>>

// `dark` values follow the Open Props adaptive convention: neutrals invert
// along the gray ramp (light surfaces → high-numbered greys, dark text →
// low-numbered greys), while brand/semantic hues (primary, destructive,
// warning, success, ring) intentionally omit `dark` and stay fixed across
// both schemes. The compiler emits `dark` under prefers-color-scheme.
const colorPalette: ColorToken[] = [
  {
    slug: "background",
    name: "Background",
    value: "hsl(var(--gray-0-hsl))",
    dark: "hsl(var(--gray-9-hsl))",
  },
  {
    slug: "foreground",
    name: "Foreground",
    value: "hsl(var(--gray-12-hsl))",
    dark: "hsl(var(--gray-1-hsl))",
  },
  {
    slug: "card",
    name: "Card",
    value: "hsl(var(--gray-0-hsl))",
    dark: "hsl(var(--gray-8-hsl))",
  },
  {
    slug: "cardForeground",
    name: "Card Foreground",
    value: "hsl(var(--gray-12-hsl))",
    dark: "hsl(var(--gray-1-hsl))",
  },
  {
    slug: "popover",
    name: "Popover",
    value: "hsl(var(--gray-0-hsl))",
    dark: "hsl(var(--gray-8-hsl))",
  },
  {
    slug: "popoverForeground",
    name: "Popover Foreground",
    value: "hsl(var(--gray-12-hsl))",
    dark: "hsl(var(--gray-1-hsl))",
  },
  { slug: "primary", name: "Primary", value: "hsl(var(--blue-6-hsl))" },
  {
    slug: "primaryForeground",
    name: "Primary Foreground",
    value: "hsl(var(--gray-0-hsl))",
  },
  {
    slug: "secondary",
    name: "Secondary",
    value: "hsl(var(--gray-2-hsl))",
    dark: "hsl(var(--gray-8-hsl))",
  },
  {
    slug: "secondaryForeground",
    name: "Secondary Foreground",
    value: "hsl(var(--gray-12-hsl))",
    dark: "hsl(var(--gray-1-hsl))",
  },
  {
    slug: "muted",
    name: "Muted",
    value: "hsl(var(--gray-2-hsl))",
    dark: "hsl(var(--gray-8-hsl))",
  },
  {
    slug: "mutedForeground",
    name: "Muted Foreground",
    value: "hsl(var(--gray-7-hsl))",
    dark: "hsl(var(--gray-4-hsl))",
  },
  {
    slug: "accent",
    name: "Accent",
    value: "hsl(var(--gray-2-hsl))",
    dark: "hsl(var(--gray-8-hsl))",
  },
  {
    slug: "accentForeground",
    name: "Accent Foreground",
    value: "hsl(var(--gray-12-hsl))",
    dark: "hsl(var(--gray-1-hsl))",
  },
  { slug: "destructive", name: "Destructive", value: "hsl(var(--red-6-hsl))" },
  { slug: "warning", name: "Warning", value: "hsl(var(--yellow-6-hsl))" },
  {
    slug: "warningForeground",
    name: "Warning Foreground",
    value: "hsl(var(--gray-0-hsl))",
  },
  { slug: "success", name: "Success", value: "hsl(var(--green-6-hsl))" },
  {
    slug: "successForeground",
    name: "Success Foreground",
    value: "hsl(var(--gray-0-hsl))",
  },
  {
    slug: "border",
    name: "Border",
    value: "color-mix(in oklch, hsl(var(--gray-12-hsl)) 10%, transparent)",
    dark: "color-mix(in oklch, hsl(var(--gray-0-hsl)) 12%, transparent)",
  },
  {
    slug: "input",
    name: "Input",
    value: "color-mix(in oklch, hsl(var(--gray-12-hsl)) 15%, transparent)",
    dark: "color-mix(in oklch, hsl(var(--gray-0-hsl)) 18%, transparent)",
  },
  { slug: "ring", name: "Ring", value: "hsl(var(--blue-6-hsl))" },
]

const fontFamilies: Token[] = [
  { slug: "body", name: "Body Font", value: "var(--font-sans)" },
  { slug: "heading", name: "Heading Font", value: "var(--font-sans)" },
]

// Font-size scale follows WP's small/medium/large/x-large/xx-large
// labels mapped onto Open Props' modular scale. `medium` is the body
// baseline (1rem); the steps roughly double-and-a-half.
const fontSizes: FontSizeToken[] = [
  { slug: "small", name: "Small", value: "var(--font-size-0)" },
  { slug: "medium", name: "Medium", value: "var(--font-size-1)" },
  { slug: "large", name: "Large", value: "var(--font-size-3)" },
  { slug: "x-large", name: "Extra Large", value: "var(--font-size-5)" },
  { slug: "xx-large", name: "2X Large", value: "var(--font-size-7)" },
  { slug: "xxx-large", name: "3X Large", value: "var(--font-size-8)" },
]

const fontWeights: Token[] = [
  { slug: "light", name: "Light", value: "var(--font-weight-3)" },
  { slug: "regular", name: "Regular", value: "var(--font-weight-4)" },
  { slug: "medium", name: "Medium", value: "var(--font-weight-5)" },
  { slug: "semibold", name: "Semibold", value: "var(--font-weight-6)" },
  { slug: "bold", name: "Bold", value: "var(--font-weight-7)" },
]

const lineHeights: Token[] = [
  { slug: "tight", name: "Tight", value: "var(--font-lineheight-0)" },
  { slug: "snug", name: "Snug", value: "var(--font-lineheight-1)" },
  { slug: "normal", name: "Normal", value: "var(--font-lineheight-3)" },
  { slug: "relaxed", name: "Relaxed", value: "var(--font-lineheight-4)" },
]

const letterSpacings: Token[] = [
  { slug: "tight", name: "Tight", value: "var(--font-letterspacing--1)" },
  { slug: "normal", name: "Normal", value: "var(--font-letterspacing-0)" },
  { slug: "wide", name: "Wide", value: "var(--font-letterspacing-2)" },
]

// Spacing scale follows Tailwind-conventional names mapped onto Open
// Props sizes. `md` is roughly 1rem so it lines up with the body
// font-size baseline. The step ratios are uneven on purpose — picked
// for usable rhythm rather than mechanical doubling.
const spacingSizes: Token[] = [
  { slug: "xs", name: "Extra Small", value: "var(--size-1)" },
  { slug: "sm", name: "Small", value: "var(--size-2)" },
  { slug: "md", name: "Medium", value: "var(--size-4)" },
  { slug: "lg", name: "Large", value: "var(--size-6)" },
  { slug: "xl", name: "Extra Large", value: "var(--size-8)" },
  { slug: "xxl", name: "2X Large", value: "var(--size-10)" },
]

const borderRadii: Token[] = [
  { slug: "sm", name: "Small", value: "var(--radius-1)" },
  { slug: "md", name: "Medium", value: "var(--radius-2)" },
  { slug: "lg", name: "Large", value: "var(--radius-3)" },
  { slug: "xl", name: "Extra Large", value: "var(--radius-4)" },
  { slug: "full", name: "Full", value: "var(--radius-round)" },
]

const borderWidths: Token[] = [
  { slug: "thin", name: "Thin", value: "var(--border-size-1)" },
  { slug: "medium", name: "Medium", value: "var(--border-size-2)" },
  { slug: "thick", name: "Thick", value: "var(--border-size-3)" },
]

// border.styles are CSS keywords, not Open Props vars — Open Props
// doesn't model these.
const borderStyles: Token[] = [
  { slug: "solid", name: "Solid", value: "solid" },
  { slug: "dashed", name: "Dashed", value: "dashed" },
  { slug: "dotted", name: "Dotted", value: "dotted" },
]

const shadowPresets: Token[] = [
  { slug: "sm", name: "Small", value: "var(--shadow-1)" },
  { slug: "md", name: "Medium", value: "var(--shadow-2)" },
  { slug: "lg", name: "Large", value: "var(--shadow-3)" },
  { slug: "xl", name: "Extra Large", value: "var(--shadow-4)" },
  { slug: "xxl", name: "2X Large", value: "var(--shadow-5)" },
]

// Default theme = "blue + system-sans". Matches COLOR_PRESETS[blue] and
// TYPOGRAPHY_PRESETS[system-sans] exactly, so on first run the preset
// cards reflect the active state.
//
// `styles` populates element-level defaults so the new compileTheme
// styles path produces visible output: every <button> picks up the
// brand primary; h1-h6 use the heading font on a descending size ramp
// (xxx-large down to small, with h6 as an uppercase eyebrow); links
// inherit primary with a hover underline; figcaption and cite get muted
// caption text and italics respectively. Slugs in StyleRefs
// are written exactly as stored in the token arrays — resolveStyleRef
// kebabs them when assembling the final CSS variable name.
export const defaultTheme: Theme = {
  version: 1,
  settings: {
    color: { palette: colorPalette },
    typography: {
      fontFamilies,
      fontSizes,
      fontWeights,
      lineHeights,
      letterSpacings,
    },
    spacing: { sizes: spacingSizes },
    border: {
      radii: borderRadii,
      widths: borderWidths,
      styles: borderStyles,
    },
    shadow: { presets: shadowPresets },
  },
  styles: {
    color: {
      text: "var:preset|color|foreground",
      background: "var:preset|color|background",
    },
    typography: {
      fontFamily: "var:preset|font-family|body",
      fontSize: "var:preset|font-size|medium",
      lineHeight: "var:preset|line-height|normal",
    },
    // Root block-gap drives the `.tc-entry-content` vertical-rhythm owl in
    // tc-normalize.css (compiled to `--tc--style--block-gap` on :root). The
    // `lg` spacing token (--size-6 ≈ 1.5rem) matches the tc-normalize
    // fallback; editing it (or the token) re-themes the gap on both surfaces.
    spacing: { blockGap: "var:preset|spacing|lg" },
    elements: {
      heading: {
        typography: {
          fontFamily: "var:preset|font-family|heading",
          fontWeight: "var:preset|font-weight|bold",
          lineHeight: "var:preset|line-height|tight",
        },
      },
      h1: { typography: { fontSize: "var:preset|font-size|xxx-large" } },
      h2: { typography: { fontSize: "var:preset|font-size|xx-large" } },
      h3: { typography: { fontSize: "var:preset|font-size|x-large" } },
      h4: { typography: { fontSize: "var:preset|font-size|large" } },
      h5: { typography: { fontSize: "var:preset|font-size|medium" } },
      h6: {
        typography: {
          fontSize: "var:preset|font-size|small",
          fontWeight: "var:preset|font-weight|semibold",
          letterSpacing: "var:preset|letter-spacing|wide",
          textTransform: "uppercase",
        },
      },
      button: {
        color: {
          text: "var:preset|color|primaryForeground",
          background: "var:preset|color|primary",
        },
        border: { radius: "var:preset|radius|md" },
      },
      link: {
        color: { text: "var:preset|color|primary" },
        ":hover": {
          typography: { textDecoration: "underline" },
        },
      },
      caption: {
        color: { text: "var:preset|color|mutedForeground" },
        typography: {
          fontSize: "var:preset|font-size|small",
          lineHeight: "var:preset|line-height|snug",
        },
      },
      cite: { typography: { fontStyle: "italic" } },
    },
  },
}

export const defaultActivePresetId: ActivePresetId = {
  color: "blue",
  "font-family": "system-sans",
}

/**
 * Categories we know how to hydrate from a stored `:root` style object.
 * Each entry pairs a `PresetCategory` (used to build the variable name)
 * with an accessor that returns the matching `Token[]` slot in the
 * mutable theme draft.
 */
const HYDRATABLE: ReadonlyArray<{
  category: PresetCategory
  pick: (draft: Theme) => Token[] | undefined
}> = [
  { category: "color", pick: (t) => t.settings.color?.palette },
  { category: "font-family", pick: (t) => t.settings.typography?.fontFamilies },
  {
    // FontSizeToken extends Token; the hydration loop only mutates
    // `value`, so the cast is safe. Stored clamp() expressions land in
    // `value` and pass through `fontSizeCss` unchanged on next compile.
    category: "font-size",
    pick: (t) => t.settings.typography?.fontSizes as Token[] | undefined,
  },
  { category: "font-weight", pick: (t) => t.settings.typography?.fontWeights },
  { category: "line-height", pick: (t) => t.settings.typography?.lineHeights },
  {
    category: "letter-spacing",
    pick: (t) => t.settings.typography?.letterSpacings,
  },
  { category: "spacing", pick: (t) => t.settings.spacing?.sizes },
  { category: "radius", pick: (t) => t.settings.border?.radii },
  { category: "border-width", pick: (t) => t.settings.border?.widths },
  { category: "border-style", pick: (t) => t.settings.border?.styles },
  { category: "shadow", pick: (t) => t.settings.shadow?.presets },
]

/**
 * Overlay stored CSS variable values onto a base theme draft. Tokens
 * absent from `styles` keep their default value, so this is safe across
 * additive schema changes.
 */
export const tokensFromStored = (
  base: Theme,
  styles: Record<string, string>
): Theme => {
  const next = structuredClone(base)
  for (const { category, pick } of HYDRATABLE) {
    const tokens = pick(next)
    if (!tokens) continue
    for (const token of tokens) {
      const stored = styles[presetVarName(category, token.slug)]
      if (typeof stored === "string" && stored.length > 0) {
        token.value = stored
      }
    }
  }
  return next
}
