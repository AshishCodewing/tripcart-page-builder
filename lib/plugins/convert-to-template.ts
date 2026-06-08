/**
 * Convert-to-template shared helpers.
 *
 * The "More" entry point lives entirely in the React `FloatingToolbar`
 * (components/page-builder/floating-toolbar.tsx): it renders the button,
 * gates it with `isConvertibleSelection`, and fires `CONVERT_OPEN_EVENT`
 * with the button's screen rect so the editor shell can open a
 * position-anchored DropdownMenu. This module only exposes the event name
 * and the shared gate — there's no GrapesJS-native toolbar injection.
 */

import type { Component } from "grapesjs"

import { TEMPLATE_REF_TYPE } from "./template-ref"

export const CONVERT_OPEN_EVENT = "tc:convert:open-menu"

/**
 * Whether a selected component may be converted to a template. Shared by
 * the GrapesJS toolbar injection (this plugin) and the React
 * FloatingToolbar so both gate identically.
 *
 *   - Skips `template-ref` (already a ref).
 *   - Skips locked components.
 *   - Skips the root `wrapper` / any parentless node: converting the
 *     whole page is meaningless, and the synced swap's
 *     `selected.replaceWith(...)` throws on a node with no parent
 *     collection (`undefined.indexOf`). It also produced malformed
 *     `wrapper`-rooted template data. Guard at the source.
 */
export function isConvertibleSelection(
  cmp: Component | null | undefined
): boolean {
  if (!cmp) return false
  if (cmp.get("type") === TEMPLATE_REF_TYPE) return false
  if (cmp.get("type") === "wrapper") return false
  if (cmp.get("locked")) return false
  if (!cmp.parent()) return false
  return true
}
