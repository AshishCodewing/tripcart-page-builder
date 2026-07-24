// The one component type that opts into the ProseMirror RTE.
//
// The ProseMirror engine is installed globally via `editor.setCustomRte(...)`
// (prosemirror-rte.ts) — GrapesJS has only a single custom-RTE slot — so the
// router there scopes the rich editing experience to this `rich-text` type and
// leaves every other editable node on plain `contenteditable` (no toolbar).
//
// This is a plain `<div>` container that extends the built-in `text` type, so
// it inherits `editable: true` and the full text-editing lifecycle
// (double-click to edit, `disableEditing` → `getContent` sync via
// `parseContent`). The `.tc-rich-text` marker class lets `isComponent`
// re-identify the node when raw HTML is re-parsed; project JSON already
// persists `type`, so this is only a safety net.

import type { Editor, Plugin } from "grapesjs"

export const RICH_TEXT_TYPE = "rich-text"

const MARKER_CLASS = "tc-rich-text"

// Block-Manager thumbnail — a paragraph-of-text glyph.
const ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 10h16M4 14h10M4 18h10"/></svg>`

/** Registers the `rich-text` component type and its draggable block. */
export const richTextBlockPlugin: Plugin = (editor: Editor): void => {
  editor.Components.addType(RICH_TEXT_TYPE, {
    // Inherit the built-in text type's editing behavior; the router in
    // prosemirror-rte.ts keys off `type === RICH_TEXT_TYPE` to mount ProseMirror.
    extend: "text",
    isComponent: (el) => {
      if (!el || typeof el !== "object" || !("classList" in el)) return false
      return (el as HTMLElement).classList?.contains(MARKER_CLASS)
    },
    model: {
      defaults: {
        name: "Rich Text",
        tagName: "div",
        editable: true,
        // A single ProseMirror document owns the block's contents — authors
        // don't drop other components inside it.
        droppable: false,
        attributes: { class: MARKER_CLASS },
      },
    },
  })

  // Sit alongside the plain Text block in the same "Basic" bucket
  // gjsBlocksBasic uses.
  editor.Blocks.add(RICH_TEXT_TYPE, {
    label: "Rich Text",
    category: "Basic",
    media: ICON,
    activate: true,
    // `components` (parsed as child nodes), not `content` — a `content` HTML
    // string is escaped into a literal text node by the text base type.
    content: {
      type: RICH_TEXT_TYPE,
      components: "<p>Insert rich text…</p>",
    },
  })
}

export default richTextBlockPlugin
