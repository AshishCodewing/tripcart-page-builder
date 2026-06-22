/**
 * Registers the four single-post field component types (Plan 013, "Option C").
 *
 * A single-post LAYOUT (the reserved `single` template-hierarchy slug) is
 * authored on the canvas from these locked blocks:
 *   - Post Title           → `post-title`           (default `<h1>`)
 *   - Post Featured Image  → `post-featured-image`  (`<img>`)
 *   - Post Date            → `post-date`            (default `<time>`)
 *   - Content slot         → `content-slot`         (`<div>`, post body)
 *
 * On the canvas they render a static placeholder label (the `template-ref`
 * pattern — `view.onRender`, no React-component registration). At render the
 * server-side `bindPostTemplate` (lib/cms/post-template.ts) fills them from the
 * current post. They are deliberately NOT registered as renderer components, so
 * the author's chosen `tagName` survives (heading semantics for the title, etc.)
 * and `toJSON` persists only `{ type, attributes, tagName }`.
 *
 * The four types are ALWAYS registered (so a `single` LAYOUT loaded from
 * storage re-identifies its nodes), but the draggable Block-Manager entries are
 * only added when `enabled` — i.e. when editing a LAYOUT (see editor-shell's
 * `allowPostFields` gate). Post fields make no sense on a page/pattern/part.
 *
 * GrapesJS APIs used (per docs):
 *   - `editor.Components.addType` — component-type registration
 *   - `editor.Blocks.add` — draggable sidebar blocks
 *   - `editor.Css.addRules(cssString)` — placeholder chrome as protected rules
 */

import type { Editor } from "grapesjs"
import type { ComponentDefinition } from "@/lib/plugins/react-renderer/project/types"

export const POST_TITLE_TYPE = "post-title"
export const POST_FEATURED_IMAGE_TYPE = "post-featured-image"
export const POST_DATE_TYPE = "post-date"
export const CONTENT_SLOT_TYPE = "content-slot"

const BLOCK_CATEGORY = "Post fields"

const PLACEHOLDER_CSS = `
.tc-post-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: var(--size-3, 0.75rem) var(--size-4, 1rem);
  min-height: 48px;
  background: color-mix(in oklch, var(--tc--preset--color--primary, hsl(220 90% 56%)) 8%, transparent);
  border: 1px dashed color-mix(in oklch, var(--tc--preset--color--primary, hsl(220 90% 56%)) 35%, transparent);
  border-radius: var(--tc--preset--radius--md, 0.375rem);
  font-family: var(--tc--preset--font-family--body, system-ui, sans-serif);
  font-size: var(--tc--preset--font-size--small, 0.875rem);
  color: var(--tc--preset--color--muted-foreground, hsl(0 0% 40%));
}
.tc-content-slot {
  display: block;
  padding: var(--size-4, 1rem);
  min-height: 96px;
  background: color-mix(in oklch, var(--tc--preset--color--primary, hsl(220 90% 56%)) 4%, transparent);
  border: 1px dashed color-mix(in oklch, var(--tc--preset--color--primary, hsl(220 90% 56%)) 30%, transparent);
  border-radius: var(--tc--preset--radius--md, 0.375rem);
}
.tc-post-field__label::before,
.tc-content-slot__label::before {
  content: "";
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--tc--preset--color--primary, hsl(220 90% 56%));
  flex-shrink: 0;
  margin-right: 0.5rem;
  vertical-align: middle;
}
.tc-post-field__label strong,
.tc-content-slot__label strong {
  font-weight: var(--tc--preset--font-weight--semibold, 600);
  color: var(--tc--preset--color--foreground, hsl(0 0% 10%));
}
`

type FieldDef = {
  type: string
  /** Author-facing name (Layer Manager / toolbar). */
  name: string
  /** Default rendered element. The author can restyle; the tag is preserved. */
  tagName: string
  /** Marker class so `isComponent` re-identifies a node parsed from HTML. */
  className: string
  /** Placeholder copy shown on the canvas. */
  label: string
  /** Block-Manager thumbnail SVG. */
  media: string
  /** Whether the node hosts children (only the content slot does). */
  droppable: boolean
  /**
   * Whether the default delete affordances (keyboard, layer manager, toolbar
   * trash) may remove it. The content slot is `false` so it can't be deleted
   * silently — its removal blanks every post using the template, so the
   * floating toolbar routes its deletion through an acknowledgement dialog
   * (see floating-toolbar.tsx) and removes it programmatically. @default true
   */
  removable?: boolean
}

// A void <img> field can't host a text label, so the featured image uses a
// background placeholder instead of an inner `<span>` (see onRender).
const ICON_TEXT = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h10"/></svg>`
const ICON_IMAGE = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`
const ICON_DATE = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`
const ICON_SLOT = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`

const FIELDS: FieldDef[] = [
  {
    type: POST_TITLE_TYPE,
    name: "Post Title",
    tagName: "h1",
    className: "tc-post-field tc-post-title",
    label: "Post <strong>Title</strong>",
    media: ICON_TEXT,
    droppable: false,
  },
  {
    type: POST_FEATURED_IMAGE_TYPE,
    name: "Featured Image",
    tagName: "img",
    className: "tc-post-field tc-post-featured-image",
    label: "Featured <strong>Image</strong>",
    media: ICON_IMAGE,
    droppable: false,
  },
  {
    type: POST_DATE_TYPE,
    name: "Post Date",
    tagName: "time",
    className: "tc-post-field tc-post-date",
    label: "Post <strong>Date</strong>",
    media: ICON_DATE,
    droppable: false,
  },
  {
    type: CONTENT_SLOT_TYPE,
    name: "Content",
    tagName: "div",
    className: "tc-content-slot",
    label: "Post <strong>content</strong>",
    media: ICON_SLOT,
    droppable: false,
    // Guarded delete — see FieldDef.removable.
    removable: false,
  },
]

/**
 * Starter arrangement seeded into a brand-new single-post LAYOUT (slug
 * `single`) when its canvas is empty — so the author opens onto the four
 * dynamic field blocks instead of a blank page. The nodes carry only their
 * `type`; the registered component defaults fill in tagName / class / etc.
 * Appended to the wrapper on load (see editor-shell.tsx).
 */
export const DEFAULT_SINGLE_POST_SEED: ComponentDefinition[] = [
  { type: POST_FEATURED_IMAGE_TYPE },
  {
    tagName: "header",
    components: [{ type: POST_TITLE_TYPE }, { type: POST_DATE_TYPE }],
  },
  { type: CONTENT_SLOT_TYPE },
]

export const postFieldsPlugin =
  ({ enabled }: { enabled: boolean }) =>
  (editor: Editor): void => {
    // Placeholder chrome as protected rules (stripped from saved data,
    // re-rendered into the canvas on every load) — same convention as
    // template-ref / designSystemPlugin.
    const rules = editor.Css.addRules(PLACEHOLDER_CSS)
    for (const rule of rules) rule.set("protected", true)

    for (const field of FIELDS) {
      const isImage = field.type === POST_FEATURED_IMAGE_TYPE
      const isSlot = field.type === CONTENT_SLOT_TYPE

      editor.Components.addType(field.type, {
        isComponent: (el) => {
          if (!el || typeof el !== "object" || !("classList" in el))
            return false
          return (el as HTMLElement).classList?.contains(
            field.className.split(" ")[1]
          )
        },
        model: {
          defaults: {
            tagName: field.tagName,
            name: field.name,
            draggable: true,
            // Only the content slot hosts children; the field blocks are leaves.
            droppable: field.droppable,
            // Authors restyle these (heading size, image ratio, content
            // column) but don't type into them — the value is bound at render.
            editable: false,
            stylable: true,
            selectable: true,
            hoverable: true,
            removable: field.removable ?? true,
            copyable: false,
            attributes: { class: field.className },
          },
          /**
           * Persist only the structural fields. No `content` (bound at
           * render) and no children (the field blocks are leaves; the
           * content slot's body is poured in server-side, never authored).
           */
          toJSON() {
            const model = this as unknown as {
              getAttributes: () => Record<string, unknown>
              get: (k: string) => unknown
            }
            return {
              type: field.type,
              tagName: model.get("tagName"),
              attributes: model.getAttributes(),
            }
          },
        },
        view: {
          onRender({ el }) {
            // A void <img> can't hold a label child — show the placeholder via
            // the marker class' background; nothing to inject.
            if (isImage) {
              el.classList.add("tc-post-field--image")
              return
            }
            const labelClass = isSlot
              ? "tc-content-slot__label"
              : "tc-post-field__label"
            el.innerHTML = `<span class="${labelClass}">${field.label}</span>`
          },
        },
      })

      // Draggable sidebar entry — only when authoring a LAYOUT.
      if (enabled) {
        editor.Blocks.add(`tc-${field.type}`, {
          label: field.name,
          category: BLOCK_CATEGORY,
          media: field.media,
          content: {
            type: field.type,
            ...(isImage ? { attributes: { class: FIELDS[1].className } } : {}),
          },
        })
      }
    }
  }
