/**
 * Compiles a `Theme` document to canvas CSS.
 *
 * Output is intentionally generic so it can be consumed by both
 * `editor.Css.setRule` (canvas iframe) and a `<style>` injection on
 * the outer React document:
 *
 *   - `rootVars` — `:root` declarations from `settings` + `custom`.
 *   - `rules`    — scoped CssRule descriptors from `styles`. Root
 *                  defaults land on `body`; `styles.elements.<name>` on
 *                  the matching selectors (`heading` expands across
 *                  h1–h6; `button` targets only `.tc-element-button`, the
 *                  opt-in marker class — WP's `.wp-element-button` — never
 *                  the bare tag); `styles.components.<type>` on the
 *                  selectors the block's `StyleSurface` declares (root and
 *                  named `parts`, each with allowed `states`), and nothing
 *                  for a type with no surface. Pseudo/state blocks become
 *                  separate rules, and an element's `variations` become
 *                  `<selector>.is-style-<slug>` rules emitted after the
 *                  base, mirroring WP's behavior.
 *
 * Variable naming mirrors WP:
 *   `--tc--preset--<category>--<slug>`   for registered tokens
 *   `--tc--custom--<segment>--<segment>` for the escape-hatch tree
 */

import { toKebab } from "@/lib/toKebab"
import type {
  ColorToken,
  ComponentStyleBlock,
  CustomTree,
  ElementName,
  ElementStyleBlock,
  FontSizeToken,
  PartStyleBlock,
  PseudoStyleBlock,
  StyleBlock,
  Theme,
  Token,
} from "@/lib/theme/schema"
import { getStyleSurface, type StylePart } from "@/lib/theme/style-surfaces"

/**
 * Marker class for "anything that looks like a button" regardless of tag
 * (`<a>`, `<button>`, …). `styles.elements.button` targets ONLY this class,
 * never the bare `button` tag — same as WP's `.wp-element-button` — so tab
 * buttons, toggles and other raw `<button>`s keep their own styling unless
 * they opt in. Blocks add it themselves (see lib/plugins/button).
 */
export const ELEMENT_BUTTON_CLASS = "tc-element-button"

/** Class a block toggles to opt into a theme-defined style variation. */
export const variationClass = (slug: string): string =>
  `is-style-${toKebab(slug)}`

/**
 * Kebab-case segment that appears in `--tc--preset--<category>--<slug>`.
 * Distinct from `TokenRegistry` top-level keys (some, like `typography`,
 * fan out into multiple preset categories).
 */
export type PresetCategory =
  | "color"
  | "font-family"
  | "font-size"
  | "font-weight"
  | "line-height"
  | "letter-spacing"
  | "spacing"
  | "radius"
  | "border-width"
  | "border-style"
  | "shadow"

export type CompiledRule = {
  selector: string
  style: Record<string, string>
}

export type CompiledTheme = {
  rootVars: Record<string, string>
  /**
   * `:root` overrides emitted under `@media (prefers-color-scheme: dark)`.
   * Populated only from color tokens that carry a `dark` value; empty when
   * the theme has no dark palette (in which case no media block is emitted
   * and `color-scheme` is left untouched).
   */
  darkVars: Record<string, string>
  rules: CompiledRule[]
}

export const presetVarName = (category: PresetCategory, slug: string): string =>
  `--tc--preset--${category}--${toKebab(slug)}`

export const customVarName = (path: readonly string[]): string =>
  `--tc--custom--${path.map(toKebab).join("--")}`

/**
 * Resolves a `StyleRef` into a CSS value usable in a declaration.
 *   - `var:preset|color|primary`  → `var(--tc--preset--color--primary)`
 *   - `var:custom|line-height|md` → `var(--tc--custom--line-height--md)`
 *   - anything else passes through unchanged.
 */
export const resolveStyleRef = (value: string): string => {
  if (!value.startsWith("var:")) return value
  const body = value.slice("var:".length)
  const [scope, ...rest] = body.split("|")
  if (scope === "preset" && rest.length >= 2) {
    const [category, slug] = rest
    return `var(${presetVarName(category as PresetCategory, slug)})`
  }
  if (scope === "custom" && rest.length >= 1) {
    return `var(${customVarName(rest)})`
  }
  return value
}

const fontSizeCss = (token: FontSizeToken): string =>
  token.fluid
    ? `clamp(${token.fluid.min}, ${token.value}, ${token.fluid.max})`
    : token.value

const writePresetVars = (
  out: Record<string, string>,
  category: PresetCategory,
  tokens: readonly Token[] | undefined
): void => {
  if (!tokens) return
  for (const token of tokens) {
    out[presetVarName(category, token.slug)] = token.value
  }
}

/**
 * Color palette writer. Like `writePresetVars` but also routes each token's
 * optional `dark` value into `darkOut`, keyed by the same `--tc--preset--
 * color--<slug>` name, so the caller can wrap it in a prefers-color-scheme
 * media block.
 */
const writeColorVars = (
  rootOut: Record<string, string>,
  darkOut: Record<string, string>,
  tokens: readonly ColorToken[] | undefined
): void => {
  if (!tokens) return
  for (const token of tokens) {
    const name = presetVarName("color", token.slug)
    rootOut[name] = token.value
    if (token.dark) darkOut[name] = token.dark
  }
}

const writeCustomVars = (
  out: Record<string, string>,
  tree: CustomTree,
  path: readonly string[]
): void => {
  for (const [key, value] of Object.entries(tree)) {
    const next = [...path, key]
    if (typeof value === "string") {
      out[customVarName(next)] = value
    } else {
      writeCustomVars(out, value, next)
    }
  }
}

/**
 * Selectors targeted by a given `styles.elements.<name>` entry.
 * `heading` expands to `h1, h2, …, h6` (cascade-stacked so explicit
 * `h1`/`h2`/… overrides win). Kept as a list so pseudo and variation
 * suffixes attach to every member, not just the last.
 */
const elementSelectors = (name: ElementName): string[] => {
  switch (name) {
    case "heading":
      return ["h1", "h2", "h3", "h4", "h5", "h6"]
    case "link":
      return ["a"]
    case "caption":
      return ["figcaption"]
    case "button":
      return [`.${ELEMENT_BUTTON_CLASS}`]
    default:
      return [name]
  }
}

const joinWithSuffix = (selectors: readonly string[], suffix: string): string =>
  selectors.map((s) => `${s}${suffix}`).join(", ")

const setIfRef = (
  out: Record<string, string>,
  prop: string,
  ref: string | undefined
): void => {
  if (ref) out[prop] = resolveStyleRef(ref)
}

/**
 * Flatten a single `StyleBlock` (no pseudo branches) into a CSS
 * declaration map. Each StyleRef is resolved against the preset/custom
 * naming. Properties absent from the block don't appear in the output —
 * an empty block returns `{}` and the caller skips emitting the rule.
 */
const compileBlock = (block: StyleBlock): Record<string, string> => {
  const decls: Record<string, string> = {}

  if (block.color) {
    setIfRef(decls, "color", block.color.text)
    setIfRef(decls, "background-color", block.color.background)
  }

  if (block.typography) {
    const t = block.typography
    setIfRef(decls, "font-family", t.fontFamily)
    setIfRef(decls, "font-size", t.fontSize)
    setIfRef(decls, "font-style", t.fontStyle)
    setIfRef(decls, "font-weight", t.fontWeight)
    setIfRef(decls, "line-height", t.lineHeight)
    setIfRef(decls, "letter-spacing", t.letterSpacing)
    setIfRef(decls, "text-decoration", t.textDecoration)
    setIfRef(decls, "text-transform", t.textTransform)
  }

  if (block.spacing) {
    if (block.spacing.padding) {
      const p = block.spacing.padding
      setIfRef(decls, "padding-top", p.top)
      setIfRef(decls, "padding-right", p.right)
      setIfRef(decls, "padding-bottom", p.bottom)
      setIfRef(decls, "padding-left", p.left)
    }
    if (block.spacing.margin) {
      const m = block.spacing.margin
      setIfRef(decls, "margin-top", m.top)
      setIfRef(decls, "margin-right", m.right)
      setIfRef(decls, "margin-bottom", m.bottom)
      setIfRef(decls, "margin-left", m.left)
    }
    setIfRef(decls, "gap", block.spacing.blockGap)
  }

  if (block.border) {
    setIfRef(decls, "border-color", block.border.color)
    setIfRef(decls, "border-radius", block.border.radius)
    setIfRef(decls, "border-style", block.border.style)
    setIfRef(decls, "border-width", block.border.width)
  }

  setIfRef(decls, "box-shadow", block.shadow)

  return decls
}

/**
 * Emit one rule for the base block plus one rule per state, where a state
 * is a selector suffix (`:hover`, `[aria-selected="true"]`) appended to
 * every selector in the list. Empty declaration maps are skipped so the
 * canvas isn't polluted with no-op selectors.
 */
const emitStates = (
  selectors: readonly string[],
  base: StyleBlock,
  states: Readonly<Record<string, StyleBlock | undefined>>,
  out: CompiledRule[]
): void => {
  const baseDecls = compileBlock(base)
  if (Object.keys(baseDecls).length > 0) {
    out.push({ selector: joinWithSuffix(selectors, ""), style: baseDecls })
  }
  for (const [suffix, block] of Object.entries(states)) {
    if (!block) continue
    const decls = compileBlock(block)
    if (Object.keys(decls).length > 0) {
      out.push({ selector: joinWithSuffix(selectors, suffix), style: decls })
    }
  }
}

/** Elements address states through the fixed WP pseudo keys. */
const emitWithPseudos = (
  selectors: readonly string[],
  block: PseudoStyleBlock,
  out: CompiledRule[]
): void => {
  const {
    ":hover": h,
    ":focus": f,
    ":active": a,
    ":visited": v,
    ...base
  } = block
  emitStates(
    selectors,
    base,
    { ":hover": h, ":focus": f, ":active": a, ":visited": v },
    out
  )
}

const emitPart = (
  decl: StylePart,
  block: PartStyleBlock,
  out: CompiledRule[]
): void => {
  const { states, ...base } = block
  emitStates([decl.selector], base, states ?? {}, out)
}

/**
 * A block's theme styles land on the selectors its `StyleSurface`
 * declares: top-level declarations on the root part, `parts.<name>` on
 * that part. Types without a surface are skipped — the schema already
 * validated part names, states and style groups for registered ones.
 */
const emitComponent = (
  type: string,
  block: ComponentStyleBlock,
  out: CompiledRule[]
): void => {
  const surface = getStyleSurface(type)
  if (!surface) return
  const { parts, ...root } = block
  emitPart(surface.root, root, out)
  for (const [name, part] of Object.entries(parts ?? {})) {
    const decl = surface.parts[name]
    if (!decl || !part) continue
    emitPart(decl, part, out)
  }
}

/**
 * Emit an element's base + pseudo rules, then one rule set per named
 * variation on `<selector>.is-style-<slug>`. Variations follow the base
 * in output order and carry one extra class of specificity, so they win
 * over the base regardless of how the consumer orders injected rules.
 */
const emitElement = (
  name: ElementName,
  block: ElementStyleBlock,
  out: CompiledRule[]
): void => {
  const selectors = elementSelectors(name)
  const { variations, ...base } = block
  emitWithPseudos(selectors, base, out)
  for (const [slug, variation] of Object.entries(variations ?? {})) {
    if (!variation) continue
    const suffix = `.${variationClass(slug)}`
    emitWithPseudos(
      selectors.map((s) => `${s}${suffix}`),
      variation,
      out
    )
  }
}

/**
 * Flatten a `CompiledTheme` into a CSS string, ready to drop into a
 * `<style>` block. Used by server-rendered surfaces (preview routes,
 * public renderer) that can't use `editor.Css.setRule` and instead
 * compose the tenant theme alongside per-page CSS at render time.
 *
 * The editor canvas does not call this — `designSystemPlugin` feeds
 * `rootVars` and `rules` straight into CssComposer via setRule, which
 * is the right interface for live mutation.
 */
export const compiledThemeToCss = ({
  rootVars,
  darkVars,
  rules,
}: CompiledTheme): string => {
  const hasDark = Object.keys(darkVars).length > 0

  // `color-scheme: light` is only asserted when a dark palette exists, so
  // light-only themes keep the browser default and native controls are
  // untouched. The dark block flips it to `dark` alongside the token
  // overrides — Open Props' adaptive convention.
  const rootLines = Object.entries(rootVars).map(
    ([name, value]) => `  ${name}: ${value};`
  )
  if (hasDark) rootLines.push("  color-scheme: light;")
  const rootBlock =
    rootLines.length > 0 ? `:root {\n${rootLines.join("\n")}\n}` : ""

  const darkBlock = hasDark
    ? `@media (prefers-color-scheme: dark) {\n  :root {\n${Object.entries(
        darkVars
      )
        .map(([name, value]) => `    ${name}: ${value};`)
        .join("\n")}\n    color-scheme: dark;\n  }\n}`
    : ""

  const ruleBlocks = rules
    .map(({ selector, style }) => {
      const body = Object.entries(style)
        .map(([prop, value]) => `  ${prop}: ${value};`)
        .join("\n")
      return body.length > 0 ? `${selector} {\n${body}\n}` : ""
    })
    .filter(Boolean)
    .join("\n\n")

  return [rootBlock, darkBlock, ruleBlocks].filter(Boolean).join("\n\n")
}

export const compileTheme = (theme: Theme): CompiledTheme => {
  const rootVars: Record<string, string> = {}
  const darkVars: Record<string, string> = {}
  const { settings, custom, styles } = theme

  writeColorVars(rootVars, darkVars, settings.color?.palette)

  const ty = settings.typography
  writePresetVars(rootVars, "font-family", ty?.fontFamilies)
  writePresetVars(rootVars, "font-weight", ty?.fontWeights)
  writePresetVars(rootVars, "line-height", ty?.lineHeights)
  writePresetVars(rootVars, "letter-spacing", ty?.letterSpacings)
  if (ty?.fontSizes) {
    for (const token of ty.fontSizes) {
      rootVars[presetVarName("font-size", token.slug)] = fontSizeCss(token)
    }
  }

  writePresetVars(rootVars, "spacing", settings.spacing?.sizes)

  const bd = settings.border
  writePresetVars(rootVars, "radius", bd?.radii)
  writePresetVars(rootVars, "border-width", bd?.widths)
  writePresetVars(rootVars, "border-style", bd?.styles)

  writePresetVars(rootVars, "shadow", settings.shadow?.presets)

  if (custom) writeCustomVars(rootVars, custom, [])

  const rules: CompiledRule[] = []
  if (styles) {
    // Root block — strip the nested element/component trees and feed
    // only the top-level style props through compileBlock so the body
    // rule doesn't accidentally absorb element/component selectors.
    const { elements, components, ...rootBlock } = styles

    // Root-level blockGap hoists to the WP-style `--tc--style--block-gap`
    // custom property on :root — consumed by the `.tc-entry-content`
    // flow owl in tc-normalize.css — rather than becoming a no-op `gap`
    // on the body rule (`gap` does nothing in normal block flow). Per-
    // component/element blockGap still compiles to `gap` (flex/grid) via
    // compileBlock; only the root block is hoisted here.
    const { blockGap: rootBlockGap, ...rootSpacing } = rootBlock.spacing ?? {}
    if (rootBlockGap) {
      rootVars["--tc--style--block-gap"] = resolveStyleRef(rootBlockGap)
    }

    const rootDecls = compileBlock({
      ...rootBlock,
      spacing: Object.keys(rootSpacing).length > 0 ? rootSpacing : undefined,
    })
    if (Object.keys(rootDecls).length > 0) {
      rules.push({ selector: "body", style: rootDecls })
    }

    if (elements) {
      // Iterate `heading` first so explicit h1-h6 rules win the cascade
      // when added later.
      const order: ElementName[] = [
        "heading",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "button",
        "link",
        "caption",
        "cite",
      ]
      for (const name of order) {
        const block = elements[name]
        if (!block) continue
        emitElement(name, block, rules)
      }
    }

    if (components) {
      for (const [type, block] of Object.entries(components)) {
        if (!block) continue
        emitComponent(type, block, rules)
      }
    }
  }

  return { rootVars, darkVars, rules }
}
