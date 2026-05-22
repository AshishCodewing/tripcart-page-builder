/**
 * Compiles a `Theme` document to canvas CSS.
 *
 * Output is intentionally generic so it can be consumed by both
 * `editor.Css.setRule` (canvas iframe) and a `<style>` injection on
 * the outer React document:
 *
 *   - `rootVars` — `:root` declarations from `settings` + `custom`.
 *   - `rules`    — scoped CssRule descriptors from `styles`. Stubbed
 *                  for now; populated in the styles-application PR.
 *
 * Variable naming mirrors WP:
 *   `--tc--preset--<category>--<slug>`   for registered tokens
 *   `--tc--custom--<segment>--<segment>` for the escape-hatch tree
 *
 * In addition, color-palette and font-family tokens emit a legacy
 * alias (`--theme-<slug>` / `--font-<slug>`) so pattern templates,
 * shadcn bindings, and other consumers from before the migration keep
 * resolving until they're swept onto the new names in a follow-up PR.
 */

import { toKebab } from "@/lib/toKebab"
import type {
  CustomTree,
  FontSizeToken,
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

export const presetVarName = (
  category: PresetCategory,
  slug: string
): string => `--tc--preset--${category}--${toKebab(slug)}`

export const customVarName = (path: readonly string[]): string =>
  `--tc--custom--${path.map(toKebab).join("--")}`

/**
 * Pre-migration variable name for the two categories that existed in
 * the old theme system. Returns null for newer categories — they have
 * no legacy form, only the new naming applies.
 */
export const legacyVarName = (
  category: PresetCategory,
  slug: string
): string | null => {
  if (category === "color") return `--theme-${toKebab(slug)}`
  if (category === "font-family") return `--font-${toKebab(slug)}`
  return null
}

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
    const legacy = legacyVarName(category, token.slug)
    if (legacy) out[legacy] = token.value
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

export const compileTheme = (theme: Theme): CompiledTheme => {
  const rootVars: Record<string, string> = {}
  const { settings, custom } = theme

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

  // styles compilation lands in the follow-up PR (point 2/12 of the plan).
  return { rootVars, rules: [] }
}
