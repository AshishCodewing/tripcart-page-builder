// The CSS selectors the theme targets — the one definition both the compiler
// and the Blocks screen use.
//
// This matters more than it looks: the Blocks screen edits theme rules by
// pointing GrapesJS's Style Manager at a selector string
// (`StyleManager.select(sel)`). If the screen computed selectors even slightly
// differently from `compileTheme`, it would silently edit a rule nothing
// renders. Keeping the primitives here makes that drift impossible.
//
// Kept free of `StyleTarget` so `style-targets.ts` can build on it without a
// cycle; the target-aware wrapper lives there.

import { toKebab } from "@/lib/toKebab"
import type { ElementName } from "@/lib/theme/schema"

/** The pseudo states an element style block may address, in emit order. */
export const ELEMENT_PSEUDO_KEYS = [
  ":hover",
  ":focus",
  ":active",
  ":visited",
] as const

export type ElementPseudoKey = (typeof ELEMENT_PSEUDO_KEYS)[number]

export const isElementPseudoKey = (value: string): value is ElementPseudoKey =>
  (ELEMENT_PSEUDO_KEYS as readonly string[]).includes(value)

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

const elementBase = (name: ElementName): string[] => {
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

/**
 * Selectors targeted by a `styles.elements.<name>` entry, or by one of its
 * `variations` when a slug is given. `heading` expands to `h1, h2, …, h6`
 * (cascade-stacked so explicit `h1`/`h2`/… overrides win). Kept as a list so
 * state suffixes attach to every member, not just the last.
 */
export const elementSelectors = (
  name: ElementName,
  variation?: string
): string[] => {
  const base = elementBase(name)
  return variation ? base.map((s) => `${s}.${variationClass(variation)}`) : base
}

export const joinWithSuffix = (
  selectors: readonly string[],
  suffix: string
): string => selectors.map((s) => `${s}${suffix}`).join(", ")
