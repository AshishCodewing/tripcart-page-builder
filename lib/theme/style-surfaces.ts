/**
 * Style surfaces — what a block exposes to the theme.
 *
 * WP's block.json declares `selectors` — which CSS targets each part of the
 * block. A `StyleSurface` is our version: each block declares its parts once,
 * and both the theme schema (validation on write) and the theme compiler
 * (selector emission) read it. `styles.components.<type>` in a theme is only
 * meaningful for a type registered here; the schema validates part names and
 * state keys against the declaration, and the compiler emits nothing for an
 * unregistered type.
 *
 * A part accepts every style group by default: all of them are valid CSS on any
 * element, and guessing which ones a tenant "should" want made the panel
 * inconsistent from block to block. `supports` narrows that, and exists for the
 * case it was meant for — a part where a group would genuinely break the block,
 * not a matter of taste.
 *
 * Declarations are pure data (no GrapesJS import) so the compiler can run
 * server-side. Each lives next to its block and is listed in
 * `STYLE_SURFACES` below.
 */

import { tabsStyleSurface } from "@/lib/plugins/interactive/tabs.surface"

/** Style groups a part may accept — the keys of a theme `StyleBlock`. */
export const STYLE_GROUPS = [
  "layout",
  "color",
  "typography",
  "spacing",
  "background",
  "border",
  "shadow",
  "effects",
] as const

export type StyleGroup = (typeof STYLE_GROUPS)[number]

export type StylePart = {
  /** Human label shown in the Blocks screen ("Tab button"). */
  label: string
  /**
   * Selector the theme's declarations are emitted on. Target stable roles
   * and attributes, never author-chosen class names — see the tabs CSS
   * note. Must carry real specificity (no `:where()`) so it beats the
   * block's own structural defaults.
   */
  selector: string
  /**
   * Style groups the theme may set on this part. Omit for all of them; narrow
   * only where a group would break the block.
   */
  supports?: readonly StyleGroup[]
  /**
   * Selector suffixes the theme may address as `states` (`:hover`,
   * `[aria-selected="true"]`, …). Appended verbatim to `selector`.
   */
  states: readonly string[]
}

export type StyleSurface = {
  /** GrapesJS component type — the key under `styles.components`. */
  type: string
  label: string
  /** The block's outer element; top-level declarations land here. */
  root: StylePart
  parts: Readonly<Record<string, StylePart>>
}

export const STYLE_SURFACES: readonly StyleSurface[] = [tabsStyleSurface]

const byType = new Map(STYLE_SURFACES.map((s) => [s.type, s]))

export const getStyleSurface = (type: string): StyleSurface | undefined =>
  byType.get(type)

/** A component's root part, or one of its named parts. */
export const getStylePart = (
  type: string,
  part?: string
): StylePart | undefined => {
  const surface = byType.get(type)
  if (!surface) return undefined
  return part ? surface.parts[part] : surface.root
}
