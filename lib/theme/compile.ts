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
 *                  the matching tag selector (`heading` expands across
 *                  h1–h6); `styles.components.<type>` on
 *                  `[data-gjs-type="<type>"]`. Pseudo blocks become
 *                  separate rules, mirroring WP's behavior.
 *
 * Variable naming mirrors WP:
 *   `--tc--preset--<category>--<slug>`   for registered tokens
 *   `--tc--custom--<segment>--<segment>` for the escape-hatch tree
 */

import { toKebab } from "@/lib/toKebab"
import type {
  CustomTree,
  ElementName,
  FontSizeToken,
  PseudoStyleBlock,
  StyleBlock,
  Theme,
  Token,
} from "@/lib/theme/schema"

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
 * Tag selector(s) targeted by a given `styles.elements.<name>` entry.
 * `heading` expands to `h1, h2, …, h6` (cascade-stacked so explicit
 * `h1`/`h2`/… overrides win).
 */
const elementSelector = (name: ElementName): string => {
  switch (name) {
    case "heading":
      return "h1, h2, h3, h4, h5, h6"
    case "link":
      return "a"
    case "caption":
      return "figcaption"
    default:
      return name
  }
}

const PSEUDO_KEYS = [":hover", ":focus", ":active", ":visited"] as const

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
 * Emit one rule for the base block plus one rule per defined pseudo
 * state. Empty declaration maps are skipped so the canvas isn't
 * polluted with no-op selectors.
 */
const emitWithPseudos = (
  selector: string,
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
  const baseDecls = compileBlock(base)
  if (Object.keys(baseDecls).length > 0) {
    out.push({ selector, style: baseDecls })
  }

  const pseudos: Record<(typeof PSEUDO_KEYS)[number], StyleBlock | undefined> =
    {
      ":hover": h,
      ":focus": f,
      ":active": a,
      ":visited": v,
    }
  for (const key of PSEUDO_KEYS) {
    const b = pseudos[key]
    if (!b) continue
    const decls = compileBlock(b)
    if (Object.keys(decls).length > 0) {
      out.push({ selector: `${selector}${key}`, style: decls })
    }
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
  rules,
}: CompiledTheme): string => {
  const rootBody = Object.entries(rootVars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n")
  const rootBlock = rootBody.length > 0 ? `:root {\n${rootBody}\n}` : ""

  const ruleBlocks = rules
    .map(({ selector, style }) => {
      const body = Object.entries(style)
        .map(([prop, value]) => `  ${prop}: ${value};`)
        .join("\n")
      return body.length > 0 ? `${selector} {\n${body}\n}` : ""
    })
    .filter(Boolean)
    .join("\n\n")

  return [rootBlock, ruleBlocks].filter(Boolean).join("\n\n")
}

export const compileTheme = (theme: Theme): CompiledTheme => {
  const rootVars: Record<string, string> = {}
  const { settings, custom, styles } = theme

  writePresetVars(rootVars, "color", settings.color?.palette)

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
    const rootDecls = compileBlock(rootBlock)
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
        emitWithPseudos(elementSelector(name), block, rules)
      }
    }

    if (components) {
      for (const [type, block] of Object.entries(components)) {
        if (!block) continue
        emitWithPseudos(`[data-gjs-type="${type}"]`, block, rules)
      }
    }
  }

  return { rootVars, rules }
}
