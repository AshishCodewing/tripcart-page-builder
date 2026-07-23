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
import {
  liftListItem,
  sinkListItem,
  splitListItem,
} from "prosemirror-schema-list"
import { EditorState } from "prosemirror-state"
import { EditorView } from "prosemirror-view"

import { parseElement, schema, serializeDoc } from "./schema"

const { marks, nodes } = schema

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
const viewContent = (view: TrackedView | undefined, el: HTMLElement): string => {
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

const editorKeymap = keymap({
  "Mod-b": toggleMark(marks.strong),
  "Mod-i": toggleMark(marks.em),
  "Mod-u": toggleMark(marks.underline),
  "Mod-`": toggleMark(marks.code),
  "Mod-z": undo,
  "Mod-y": redo,
  "Shift-Mod-z": redo,
  Enter: splitListItem(nodes.list_item),
  Tab: sinkListItem(nodes.list_item),
  "Shift-Tab": liftListItem(nodes.list_item),
})

// Markdown-style typing shortcuts: `- `, `1. `, `> `, `# `…`###### `.
const typingRules = inputRules({
  rules: [
    wrappingInputRule(/^\s*([-+*])\s$/, nodes.bullet_list),
    wrappingInputRule(
      /^(\d+)\.\s$/,
      nodes.ordered_list,
      (match) => ({ order: Number(match[1]) }),
      (match, node) => node.childCount + node.attrs.order === Number(match[1])
    ),
    wrappingInputRule(/^\s*>\s$/, nodes.blockquote),
    textblockTypeInputRule(/^(#{1,6})\s$/, nodes.heading, (match) => ({
      level: match[1].length,
    })),
  ],
})

const buildState = (el: HTMLElement) =>
  EditorState.create({
    doc: parseElement(el),
    plugins: [history(), typingRules, editorKeymap, keymap(baseKeymap)],
  })

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
    },

    getContent(el, view) {
      return viewContent(view as TrackedView | undefined, el)
    },
  })
}

export default rtePlugin
