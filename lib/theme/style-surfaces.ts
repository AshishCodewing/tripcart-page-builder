/**
 * Style surfaces — what a block exposes to the theme.
 *
 * WP's block.json declares `selectors` (which CSS targets each part of the
 * block) and `supports` (which style groups the block accepts). A
 * `StyleSurface` is our version: each block declares its parts once, and
 * both the theme schema (validation on write) and the theme compiler
 * (selector emission) read it. `styles.components.<type>` in a theme is
 * only meaningful for a type registered here; the schema validates part
 * names, state keys and style groups against the declaration, and the
 * compiler emits nothing for an unregistered type.
 *
 * Declarations are pure data (no GrapesJS import) so the compiler can run
 * server-side. Each lives next to its block and is listed in
 * `STYLE_SURFACES` below.
 */

import { tabsStyleSurface } from "@/lib/plugins/interactive/tabs.surface"

/** Style groups a part may accept — the keys of a theme `StyleBlock`. */
export const STYLE_GROUPS = [
  "color",
  "typography",
  "spacing",
  "border",
  "shadow",
] as const

export type StyleGroup = (typeof STYLE_GROUPS)[number]

export type StylePart = {
  /** Human label for the Step-2 UI ("Tab button"). */
  label: string
  /**
   * Selector the theme's declarations are emitted on. Target stable roles
   * and attributes, never author-chosen class names — see the tabs CSS
   * note. Must carry real specificity (no `:where()`) so it beats the
   * block's own structural defaults.
   */
  selector: string
  /** Style groups the theme may set on this part. */
  supports: readonly StyleGroup[]
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
