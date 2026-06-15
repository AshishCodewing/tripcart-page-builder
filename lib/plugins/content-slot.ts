/**
 * Registers the `content-slot` GrapesJS component type (Approach A —
 * docs/reference/templates-followups.md §14).
 *
 * A `content-slot` is the page-content hole a LAYOUT author drops into a
 * frame: it marks where the assigned page's content pours in at render.
 * It is the analogue of WordPress' `wp:post-content`. The render side
 * substitutes the page fragment for this node via the renderer's
 * `config.slotContent` (see lib/plugins/react-renderer/project) — this
 * plugin only provides the *editor* surface so a LAYOUT can be authored.
 *
 * The slot is a locked, labelled placeholder ("Page content"). It is
 * draggable (the author positions it) and removable (the author can
 * re-place it), but not editable or droppable — content goes in at render,
 * not in the LAYOUT editor. The placeholder CSS is injected as **protected**
 * rules, the same convention `templateRefPlugin` / `designSystemPlugin` use,
 * so `tc-local` strips it from saved blobs.
 *
 * `enableBlock` gates the Block-Manager entry: a draggable "Page content"
 * block is offered only in the LAYOUT editor (a page/post can't host a
 * slot). The component *type* always registers so a LAYOUT's saved tree
 * renders its slot in any canvas.
 *
 * One slot per LAYOUT (matching WP's single `post-content`): a guard removes
 * any second slot and warns. Kept intentionally small.
 *
 * GrapesJS APIs used (per docs):
 *   - `editor.Components.addType` — component-type registration
 *   - `editor.Blocks.add` — sidebar block (https://grapesjs.com/docs/api/block_manager.html)
 *   - `editor.Css.addRules(cssString)` — protected placeholder CSS
 */

import type { Editor } from "grapesjs"
import { CONTENT_SLOT_TYPE } from "@/lib/plugins/react-renderer/project"

/** Marker attribute so the slot is re-identifiable when parsed from HTML. */
export const CONTENT_SLOT_MARKER_ATTR = "data-content-slot"

const PLACEHOLDER_CSS = `
.tc-content-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: var(--size-4, 1rem);
  min-height: 96px;
  background: color-mix(in oklch, var(--tc--preset--color--primary, hsl(220 90% 56%)) 5%, transparent);
  border: 2px dashed color-mix(in oklch, var(--tc--preset--color--primary, hsl(220 90% 56%)) 35%, transparent);
  border-radius: var(--tc--preset--radius--md, 0.375rem);
  font-family: var(--tc--preset--font-family--body, system-ui, sans-serif);
  font-size: var(--tc--preset--font-size--small, 0.875rem);
  font-weight: var(--tc--preset--font-weight--semibold, 600);
  color: var(--tc--preset--color--muted-foreground, hsl(0 0% 40%));
}
.tc-content-slot__label::before {
  content: "";
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 2px;
  background: var(--tc--preset--color--primary, hsl(220 90% 56%));
  flex-shrink: 0;
  margin-right: 0.5rem;
  vertical-align: middle;
}
`

// 24×16 inline SVG: a framed box with a dashed inner region — reads as
// "content goes here". Data-URI so it needs no asset pipeline.
const BLOCK_MEDIA = `<svg viewBox="0 0 24 16" width="24" height="16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="22" height="14" rx="1.5" fill="none" stroke="currentColor" stroke-width="1"/><rect x="4" y="4" width="16" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"/></svg>`

export const contentSlotPlugin =
  ({ enableBlock }: { enableBlock: boolean }) =>
  (editor: Editor): void => {
    // Protected placeholder CSS — stripped from saved blobs by tc-local,
    // re-rendered by GrapesJS on every frame load.
    const rules = editor.Css.addRules(PLACEHOLDER_CSS)
    for (const rule of rules) rule.set("protected", true)

    editor.Components.addType(CONTENT_SLOT_TYPE, {
      isComponent: (el) =>
        !!el &&
        typeof el === "object" &&
        "getAttribute" in el &&
        typeof (el as HTMLElement).getAttribute === "function" &&
        (el as HTMLElement).getAttribute(CONTENT_SLOT_MARKER_ATTR) !== null,
      model: {
        defaults: {
          tagName: "div",
          name: "Page content",
          // Author positions it; can delete + re-place. Content is injected
          // at render, never in the LAYOUT editor.
          draggable: true,
          droppable: false,
          editable: false,
          stylable: false,
          selectable: true,
          hoverable: true,
          removable: true,
          copyable: false,
          attributes: {
            [CONTENT_SLOT_MARKER_ATTR]: "",
            class: "tc-content-slot",
          },
        },
        toJSON() {
          // Persist only the type + attributes — the placeholder chrome is
          // editor-only (class/attrs re-apply from defaults on reload).
          const model = this as unknown as import("grapesjs").Component
          return { type: CONTENT_SLOT_TYPE, attributes: model.getAttributes() }
        },
      },
      view: {
        onRender({ el }) {
          el.innerHTML = `<span class="tc-content-slot__label">Page content</span>`
        },
      },
    })

    // Block + one-slot guard only where slots are authored (LAYOUT editor).
    if (!enableBlock) return

    editor.Blocks.add(CONTENT_SLOT_TYPE, {
      label: "Page content",
      category: "Layout",
      content: { type: CONTENT_SLOT_TYPE },
      media: BLOCK_MEDIA,
      attributes: { title: "Where the page's content renders" },
    })

    // One slot per LAYOUT (WP allows one `post-content`). On any add, if a
    // second slot exists, drop the newcomer and warn. Cheap: only fires for
    // content-slot adds.
    editor.on("component:add", (model: import("grapesjs").Component) => {
      if (model.get("type") !== CONTENT_SLOT_TYPE) return
      const slots = editor.getWrapper()?.find(`[${CONTENT_SLOT_MARKER_ATTR}]`)
      if (slots && slots.length > 1) {
        model.remove()
        console.warn(
          "[content-slot] A layout can have only one Page content slot; the extra one was removed."
        )
      }
    })
  }
