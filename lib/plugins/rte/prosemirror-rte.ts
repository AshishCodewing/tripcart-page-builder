// Replaces GrapesJS' built-in execCommand RTE with ProseMirror, through the
// official `editor.setCustomRte({ enable, disable, getContent })` interface
// (grapesjs.com/docs/guides/Replace-Rich-Text-Editor.html).
//
// ProseMirror mounts directly onto the component's own DOM element
// (`new EditorView({ mount: el }, …)`), so GrapesJS keeps tracking the same
// node. The toolbar (components/page-builder/rte-toolbar.tsx) listens for the
// editor events emitted here to grab the live view and re-render on each
// transaction — GrapesJS' own `rte:custom` event belonged to the old engine.

import type { Editor, Plugin } from "grapesjs"
import { baseKeymap, toggleMark } from "prosemirror-commands"
import { history, redo, undo } from "prosemirror-history"
import {
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule,
} from "prosemirror-inputrules"
import { keymap } from "prosemirror-keymap"
import type { Schema } from "prosemirror-model"
import {
  liftListItem,
  sinkListItem,
  splitListItem,
} from "prosemirror-schema-list"
import { EditorState } from "prosemirror-state"
import { EditorView } from "prosemirror-view"

import { insertHardBreak } from "./commands"
import { isInlineHost, parseElement, schemaFor, serializeDoc } from "./schema"

/**
 * An EditorView we track across GrapesJS' enable/disable lifecycle.
 * - `__tcDead`: set once we've destroyed it, so a re-`enable` rebuilds instead
 *   of reusing a dead view.
 * - `__tcHTML`: the last serialization taken while it was alive, so `getContent`
 *   can still answer correctly after the view is gone (GrapesJS calls
 *   `getContent` again on the second `disableEditing` pass, when `activeRte`
 *   points at this now-destroyed view — serializing it would yield "" and wipe
 *   the component).
 */
type TrackedView = EditorView & { __tcDead?: boolean; __tcHTML?: string }

/** Content from a view, caching the serialization while it's still alive. */
const viewContent = (
  view: TrackedView | undefined,
  el: HTMLElement
): string => {
  if (view && !view.__tcDead) {
    view.__tcHTML = serializeDoc(view.state.doc)
    return view.__tcHTML
  }
  return view?.__tcHTML ?? el.innerHTML
}

/** Editor events the toolbar subscribes to (view + component are the payload). */
export const RTE_EVENTS = {
  enable: "tc-rte:enable",
  update: "tc-rte:update",
  disable: "tc-rte:disable",
} as const

// Mark-toggle + history shortcuts — valid for both schemas.
const markKeymap = (sc: Schema) =>
  keymap({
    "Mod-b": toggleMark(sc.marks.strong),
    "Mod-i": toggleMark(sc.marks.em),
    "Mod-u": toggleMark(sc.marks.underline),
    "Mod-`": toggleMark(sc.marks.code),
    "Mod-z": undo,
    "Mod-y": redo,
    "Shift-Mod-z": redo,
  })

// List-editing keys — only when the schema has list nodes (block schema).
const listKeymap = (sc: Schema) =>
  keymap({
    Enter: splitListItem(sc.nodes.list_item),
    Tab: sinkListItem(sc.nodes.list_item),
    "Shift-Tab": liftListItem(sc.nodes.list_item),
  })

// Line breaks for an inline (single-block) mount: the document can't be split,
// so Enter and Shift-Enter both insert a `<br>` instead of doing nothing.
const breakKeymap = keymap({
  Enter: insertHardBreak,
  "Shift-Enter": insertHardBreak,
})

// Markdown-style typing shortcuts: `- `, `1. `, `> `, `# `…`###### `.
// All produce block constructs, so they're block-schema only.
const blockInputRules = (sc: Schema) =>
  inputRules({
    rules: [
      wrappingInputRule(/^\s*([-+*])\s$/, sc.nodes.bullet_list),
      wrappingInputRule(
        /^(\d+)\.\s$/,
        sc.nodes.ordered_list,
        (match) => ({ order: Number(match[1]) }),
        (match, node) => node.childCount + node.attrs.order === Number(match[1])
      ),
      wrappingInputRule(/^\s*>\s$/, sc.nodes.blockquote),
      textblockTypeInputRule(/^(#{1,6})\s$/, sc.nodes.heading, (match) => ({
        level: match[1].length,
      })),
    ],
  })

const buildState = (el: HTMLElement) => {
  const sc = schemaFor(el)
  // The inline schema has no block nodes; its list/heading rules would throw.
  const hasBlocks = !!sc.nodes.list_item
  return EditorState.create({
    doc: parseElement(el),
    plugins: [
      history(),
      markKeymap(sc),
      ...(hasBlocks ? [blockInputRules(sc), listKeymap(sc)] : [breakKeymap]),
      keymap(baseKeymap),
    ],
  })
}

/** GrapesJS plugin: swap the RTE engine for ProseMirror. */
export const rtePlugin: Plugin = (editor: Editor) => {
  editor.setCustomRte<EditorView>({
    // Store returned HTML as Components (like the native engine) rather than an
    // opaque string, so text content round-trips through the project JSON /
    // react-renderer pipeline the same way it did before.
    parseContent: true,

    enable(el, view, opts) {
      // GrapesJS caches and re-passes the last returned instance even after we
      // destroyed it on `disable` — reuse it only when it's still alive and
      // mounted on this element (the "re-focus the active editor" case).
      // Otherwise fall through and build a fresh view; a stale/destroyed one
      // here is why re-editing showed no toolbar and swallowed typing.
      const prev = view as TrackedView | undefined
      if (prev && !prev.__tcDead && prev.dom === el) {
        prev.focus()
        return prev
      }
      const created: EditorView = new EditorView(
        { mount: el },
        {
          state: buildState(el),
          dispatchTransaction(tr) {
            created.updateState(created.state.apply(tr))
            editor.trigger(RTE_EVENTS.update, { view: created })
          },
        }
      )
      created.focus()
      // `editor.getEditing()` isn't set yet at this point — take the component
      // straight off the text view GrapesJS hands us (it anchors the toolbar).
      editor.trigger(RTE_EVENTS.enable, {
        view: created,
        component: opts?.view?.model ?? editor.getEditing(),
        // Inline mounts (a `<p>`/`<h1>`/…) edit only inline content, so the
        // toolbar hides its block-level controls.
        inline: isInlineHost(el),
      })
      return created
    },

    disable(el, view) {
      editor.trigger(RTE_EVENTS.disable)
      const dead = view as TrackedView | undefined
      if (dead && !dead.__tcDead) {
        // Snapshot the content before tearing the view down so `getContent`
        // still answers correctly on GrapesJS' repeat disable pass.
        dead.__tcHTML = serializeDoc(dead.state.doc)
        dead.__tcDead = true
        dead.destroy()
      }
      el.removeAttribute("contenteditable")
      // Force GrapesJS to rebuild the component from `getContent` even when the
      // content is unchanged. Otherwise it compares the serialized output to the
      // `lastContent` it captured at enable time (the element's raw innerHTML)
      // and, when they match, skips `syncContent`. That skip is invisible for a
      // block mount (whose innerHTML `Body` never equals the serialized
      // `<p>Body</p>`), but for an inline mount the two are identical when the
      // user didn't type — leaving the just-torn-down element empty and dropping
      // its text. `RteDisableResult.forceSync` is GrapesJS' hook for exactly this.
      return { forceSync: true }
    },

    getContent(el, view) {
      return viewContent(view as TrackedView | undefined, el)
    },
  })
}

export default rtePlugin
