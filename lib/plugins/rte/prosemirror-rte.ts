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
 * - `__tcEnableHTML`: the element's raw innerHTML captured at enable, i.e. the
 *   exact string GrapesJS records as `lastContent`. On disable GrapesJS skips
 *   `syncContent` when the serialized output equals it; when it does, nothing
 *   re-renders the (now torn-down) element, so we restore the DOM ourselves.
 */
type TrackedView = EditorView & {
  __tcDead?: boolean
  __tcHTML?: string
  __tcEnableHTML?: string
}

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
      // Snapshot the element's content before ProseMirror mounts over it — this
      // is the exact string GrapesJS just recorded as `lastContent`, and what it
      // compares the serialized output against on disable to decide whether to
      // sync. `disable` uses it to know when it must restore the DOM itself.
      const enableHTML = el.innerHTML
      const created: TrackedView = new EditorView(
        { mount: el },
        {
          state: buildState(el),
          dispatchTransaction(tr) {
            created.updateState(created.state.apply(tr))
            editor.trigger(RTE_EVENTS.update, { view: created })
          },
        }
      )
      created.__tcEnableHTML = enableHTML
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
      let restore: string | undefined
      if (dead && !dead.__tcDead) {
        // Snapshot the content before tearing the view down so `getContent`
        // still answers correctly on GrapesJS' repeat disable pass.
        dead.__tcHTML = serializeDoc(dead.state.doc)
        // GrapesJS skips `syncContent` exactly when this serialized output equals
        // the content it captured at enable (`lastContent` === our
        // `__tcEnableHTML`). That's the case we must patch: the sync that would
        // otherwise repaint the element won't run.
        if (dead.__tcHTML === dead.__tcEnableHTML) restore = dead.__tcHTML
        dead.__tcDead = true
        // Destroying a mounted view empties the element it was mounted on.
        dead.destroy()
      }
      el.removeAttribute("contenteditable")
      // Nothing changed, so GrapesJS won't sync and nothing repaints the element
      // ProseMirror just emptied — the text would vanish (visible on inline/leaf
      // mounts, where the serialized output matches the innerHTML byte-for-byte).
      // Restore it with a plain DOM write: it fires no model events, so it never
      // provokes the React canvas re-render whose teardown/removeChild race a
      // forced `syncContent` on an unchanged doc used to set off. When the
      // content did change we leave the element alone — GrapesJS' own sync
      // repaints it from the rebuilt component.
      if (restore != null) el.innerHTML = restore
    },

    getContent(el, view) {
      return viewContent(view as TrackedView | undefined, el)
    },
  })
}

export default rtePlugin
