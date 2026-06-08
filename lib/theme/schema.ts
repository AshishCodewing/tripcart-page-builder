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
 */

export type ThemeVersion = 1

export type CssValue = string

export type Token = {
  slug: string
  name: string
  value: CssValue
}

export type FontSizeToken = Token & {
  /** When set, the compiler emits a `clamp(min, value, max)` fluid size. */
  fluid?: { min: CssValue; max: CssValue }
}

export type TokenRegistry = {
  color?: {
    palette?: Token[]
  }
  typography?: {
    fontFamilies?: Token[]
    fontSizes?: FontSizeToken[]
    fontWeights?: Token[]
    lineHeights?: Token[]
    letterSpacings?: Token[]
  }
  spacing?: {
    sizes?: Token[]
  }
  border?: {
    radii?: Token[]
    widths?: Token[]
    styles?: Token[]
  }
  shadow?: {
    presets?: Token[]
  }
  layout?: {
    contentSize?: CssValue
    wideSize?: CssValue
  }
  dimensions?: {
    minHeight?: CssValue
  }
}

/**
 * A `StyleRef` is either a raw CSS value or a preset/custom reference
 * resolved by the compiler:
 *   - `var:preset|<category>|<slug>` → `var(--tc--preset--<category>--<slug>)`
 *   - `var:custom|<path>|<segments>` → `var(--tc--custom--<path>--<segments>)`
 */
export type StyleRef = string

export type ColorStyle = {
  text?: StyleRef
  background?: StyleRef
}

export type TypographyStyle = {
  fontFamily?: StyleRef
  fontSize?: StyleRef
  fontWeight?: StyleRef
  lineHeight?: StyleRef
  letterSpacing?: StyleRef
  textDecoration?: StyleRef
  textTransform?: StyleRef
}

export type BoxStyle = {
  top?: StyleRef
  right?: StyleRef
  bottom?: StyleRef
  left?: StyleRef
}

export type SpacingStyle = {
  padding?: BoxStyle
  margin?: BoxStyle
  blockGap?: StyleRef
}

export type BorderStyle = {
  color?: StyleRef
  radius?: StyleRef
  style?: StyleRef
  width?: StyleRef
}

export type StyleBlock = {
  color?: ColorStyle
  typography?: TypographyStyle
  spacing?: SpacingStyle
  border?: BorderStyle
  shadow?: StyleRef
}

export type PseudoStyleBlock = StyleBlock & {
  ":hover"?: StyleBlock
  ":focus"?: StyleBlock
  ":active"?: StyleBlock
  ":visited"?: StyleBlock
}

/**
 * Mirrors WP's supported element list. Each maps to a class handle the
 * renderer attaches (e.g. `tc-element-button`), so element-level defaults
 * target a class rather than a tag — same trick WP uses with
 * `.wp-element-button`.
 */
export type ElementName =
  | "button"
  | "link"
  | "heading"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "caption"
  | "cite"

export type StyleDefaults = StyleBlock & {
  elements?: Partial<Record<ElementName, PseudoStyleBlock>>
  /**
   * Keyed by GrapesJS component `type`. Open-ended (no fixed enum) so
   * new patterns/blocks register without a schema bump. The compiler
   * targets the component's root selector (typically
   * `.tc-component-<type>`).
   */
  components?: Record<string, PseudoStyleBlock>
}

export type CustomTree = { [key: string]: CssValue | CustomTree }

export type Theme = {
  version: ThemeVersion
  settings: TokenRegistry
  styles?: StyleDefaults
  custom?: CustomTree
}
