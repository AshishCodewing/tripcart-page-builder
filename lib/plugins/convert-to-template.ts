/**
 * Registers the "Convert to template" toolbar entry point.
 *
 * Adds a single new "More" toolbar item (ellipsis icon) to every
 * selectable component via Pattern C — subscribe to `component:selected`
 * and mutate the model's `toolbar` array. We don't use Pattern A
 * (per-type defaults) because that would require touching every
 * component-type registration in the codebase; the subscriber walks
 * any selection regardless of how the type was declared.
 *
 * Behavior:
 *   - Skips template-ref nodes (already a ref; converting is a no-op).
 *   - Skips locked components.
 *   - Idempotent — re-selecting the same component does not duplicate
 *     the toolbar item.
 *   - The item's command queries the rendered button's DOM rect and
 *     fires `CONVERT_OPEN_EVENT` so the React shell can open a
 *     position-anchored shadcn DropdownMenu. The plugin layer has no
 *     React/portal/router access, so we hand off via event.
 *
 * The slot is named "more" to leave room for future entries (Save as
 * pattern, Lock, …) in the same dropdown — see §Deferred in
 * docs/templates-followups.md.
 */

import type { Component, Editor, ToolbarButtonProps } from "grapesjs"

import { TEMPLATE_REF_TYPE } from "./template-ref"

export const CONVERT_OPEN_EVENT = "tc:convert:open-menu"
export const CONVERT_OPEN_CMD = "tc:convert:open-menu"

const MORE_BUTTON_CLASS = "tc-convert-more"

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

export const convertToTemplatePlugin = (editor: Editor): void => {
  // Resolve the button's rendered DOM rect at click time, then hand off
  // to the React shell. We query inside the editor's host document
  // because the GrapesJS toolbar lives in the outer DOM, not the canvas
  // iframe.
  editor.Commands.add(CONVERT_OPEN_CMD, {
    run(ed) {
      const btn = document.querySelector(`.${MORE_BUTTON_CLASS}`)
      const rect = btn?.getBoundingClientRect()
      ed.trigger(CONVERT_OPEN_EVENT, {
        rect: rect
          ? { x: rect.left, y: rect.bottom, width: rect.width }
          : null,
      })
    },
  })

  editor.on("component:selected", (cmp) => {
    if (!isConvertibleSelection(cmp)) return

    const current =
      (cmp.get("toolbar") as ToolbarButtonProps[] | undefined) ?? []
    const alreadyPresent = current.some((it) => {
      const cls = (it.attributes as { class?: string } | undefined)?.class
      return typeof cls === "string" && cls.includes(MORE_BUTTON_CLASS)
    })
    if (alreadyPresent) return

    const next: ToolbarButtonProps[] = [
      ...current,
      {
        attributes: {
          class: `fa fa-ellipsis-v ${MORE_BUTTON_CLASS}`,
          title: "More actions",
        },
        command: CONVERT_OPEN_CMD,
      },
    ]
    cmp.set("toolbar", next)
  })
}
