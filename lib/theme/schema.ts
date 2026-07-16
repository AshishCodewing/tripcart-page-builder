/**
 * Theme document shape, inspired by WordPress theme.json.
 *
 * Two halves:
 *   - `settings` — registry of design tokens. Compiles to
 *     `--tc--preset--<category>--<slug>` CSS variables.
 *   - `styles`   — default style application (root, per-element,
 *     per-component). Compiles to scoped CssRules in the canvas.
 *
 * `custom` is an open-ended escape hatch: any nested object compiles to
 * `--tc--custom--<path>` variables with auto-hyphenated path segments.
 *
 * Token values are CSS values that typically reference Open Props
 * (e.g. `hsl(var(--blue-6-hsl))`, `var(--size-3)`) so swapping the
 * Open Props baseline cascades.
 *
 * Slugs are stable identifiers — they appear inside CSS variable names
 * AND inside `styles` references (`var:preset|color|primary`). The
 * editor UI should treat `slug` as write-once; renaming `name` is cheap,
 * renaming `slug` invalidates every authored reference.
 *
 * Every type here is DERIVED from the Zod validator in `./schema.zod.ts`
 * via `z.infer` — that file is the single source of truth; change the
 * shape there. (`CssValue`/`StyleRef` stay hand-written string aliases:
 * they only carry documentation, Zod sees plain strings. `ElementName`
 * is derived from the elements schema's key set.)
 */

import type { z } from "zod"

import type {
  borderStyleSchema,
  boxStyleSchema,
  colorStyleSchema,
  colorTokenSchema,
  elementsSchema,
  fontSizeTokenSchema,
  pseudoStyleBlockSchema,
  spacingStyleSchema,
  styleBlockSchema,
  styleDefaultsSchema,
  themeSchema,
  tokenRegistrySchema,
  tokenSchema,
  typographyStyleSchema,
} from "./schema.zod"

export type ThemeVersion = 1

export type CssValue = string

export type Token = z.infer<typeof tokenSchema>

/** Color token with an optional `dark` value (prefers-color-scheme override). */
export type ColorToken = z.infer<typeof colorTokenSchema>

/** `fluid` set means the compiler emits a `clamp(min, value, max)` size. */
export type FontSizeToken = z.infer<typeof fontSizeTokenSchema>

export type TokenRegistry = z.infer<typeof tokenRegistrySchema>

/**
 * A `StyleRef` is either a raw CSS value or a preset/custom reference
 * resolved by the compiler:
 *   - `var:preset|<category>|<slug>` → `var(--tc--preset--<category>--<slug>)`
 *   - `var:custom|<path>|<segments>` → `var(--tc--custom--<path>--<segments>)`
 */
export type StyleRef = string

export type ColorStyle = z.infer<typeof colorStyleSchema>

export type TypographyStyle = z.infer<typeof typographyStyleSchema>

export type BoxStyle = z.infer<typeof boxStyleSchema>

export type SpacingStyle = z.infer<typeof spacingStyleSchema>

export type BorderStyle = z.infer<typeof borderStyleSchema>

export type StyleBlock = z.infer<typeof styleBlockSchema>

export type PseudoStyleBlock = z.infer<typeof pseudoStyleBlockSchema>

/**
 * Mirrors WP's supported element list. Each compiles to a bare tag
 * selector (`heading` → `h1, …, h6`, `link` → `a`, `caption` →
 * `figcaption`, everything else the tag as-is) — see `elementSelector`
 * in `./compile.ts`. Derived from the elements schema's key set.
 */
export type ElementName = keyof z.infer<typeof elementsSchema>

/**
 * `components` is keyed by GrapesJS component `type`. Open-ended (no
 * fixed enum) so new patterns/blocks register without a schema bump. The
 * compiler targets each type via its `[data-gjs-type="<type>"]` selector.
 */
export type StyleDefaults = z.infer<typeof styleDefaultsSchema>

export type { CustomTree } from "./schema.zod"

export type Theme = z.infer<typeof themeSchema>
