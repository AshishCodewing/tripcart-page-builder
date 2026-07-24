// Replaces GrapesJS' built-in execCommand RTE with ProseMirror, through the
// official `editor.setCustomRte({ enable, disable, getContent })` interface
// (grapesjs.com/docs/guides/Replace-Rich-Text-Editor.html).
//
// ProseMirror mounts directly onto the component's own DOM element
// (`new EditorView({ mount: el }, …)`), so GrapesJS keeps tracking the same
// node. The toolbar (components/page-builder/rte-toolbar.tsx) listens for the
// editor events emitted here to grab the live view and re-render on each
// transaction.
//
// Lifecycle follows GrapesJS Studio's `rteProseMirror`: we track each edited
// element in a WeakMap holding its view + component + the ProseMirror doc it
// started from (`initialDoc`). Whether the content changed is decided by
// `initialDoc.eq(currentDoc)` — a structural ProseMirror comparison, never
// HTML-string compares. On disable we return `{ forceSync: changed }`; when
// nothing changed we instead re-render the component from its model to repaint
// the element the destroyed view emptied. No raw `innerHTML` writes.

import type { Component, Editor, Plugin } from "grapesjs"
import { baseKeymap, toggleMark } from "prosemirror-commands"
import { history, redo, undo } from "prosemirror-history"
import {
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule,
} from "prosemirror-inputrules"
import { keymap } from "prosemirror-keymap"
import type { Node as PMNode } from "prosemirror-model"
import {
  liftListItem,
  sinkListItem,
  splitListItem,
} from "prosemirror-schema-list"
import { EditorState } from "prosemirror-state"
import { EditorView } from "prosemirror-view"

import { RTE_REPAINT_EVENT } from "@/lib/plugins/react-renderer"

import { RICH_TEXT_TYPE } from "./rich-text-block"
import { parseElement, schema, serializeDoc } from "./schema"

/** Per-element editing state, keyed by the mounted DOM element. */
type RteEntry = {
  view: EditorView
  component: Component
  /** The doc the session started from, for structural change detection. */
  initialDoc: PMNode
}

const elToEntry = new WeakMap<HTMLElement, RteEntry>()

/**
 * The marker returned for the "plain" branch — any editable node that isn't a
 * `rich-text` component. It edits as bare `contenteditable` with no toolbar (no
 * ProseMirror mount, no `tc-rte:*` events), so the RTE stays fully contained to
 * the one opt-in block.
 */
type PlainRte = { __tcPlain: true }

type Rte = EditorView | PlainRte

const isPlain = (rte: Rte | undefined): rte is PlainRte =>
  !!rte && (rte as PlainRte).__tcPlain === true

/**
 * Whether the component being edited opts into ProseMirror. GrapesJS routes
 * every text edit through the single custom-RTE object, so we scope the rich
 * engine to the `rich-text` type here (see rich-text-block.ts).
 */
const usesProseMirror = (comp: { get?: (k: string) => unknown } | undefined) =>
  comp?.get?.("type") === RICH_TEXT_TYPE

/** Did the element's doc change since the session started? (structural). */
const docChanged = (el: HTMLElement): boolean => {
  const entry = elToEntry.get(el)
  return !(entry && entry.initialDoc.eq(entry.view.state.doc))
}

/** Editor events the toolbar subscribes to (view + component are the payload). */
export const RTE_EVENTS = {
  enable: "tc-rte:enable",
  update: "tc-rte:update",
  disable: "tc-rte:disable",
} as const

// Mark-toggle + history shortcuts.
const markKeymap = () =>
  keymap({
    "Mod-b": toggleMark(schema.marks.strong),
    "Mod-i": toggleMark(schema.marks.em),
    "Mod-u": toggleMark(schema.marks.underline),
    "Mod-z": undo,
    "Mod-y": redo,
    "Shift-Mod-z": redo,
  })

// List-editing keys.
const listKeymap = () =>
  keymap({
    Enter: splitListItem(schema.nodes.list_item),
    Tab: sinkListItem(schema.nodes.list_item),
    "Shift-Tab": liftListItem(schema.nodes.list_item),
  })

// Markdown-style typing shortcuts: `- `, `1. `, `> `, `# `…`###### `.
const blockInputRules = () =>
  inputRules({
    rules: [
      wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
      wrappingInputRule(
        /^(\d+)\.\s$/,
        schema.nodes.ordered_list,
        (match) => ({ order: Number(match[1]) }),
        (match, node) => node.childCount + node.attrs.order === Number(match[1])
      ),
      wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
      textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (match) => ({
        level: match[1].length,
      })),
    ],
  })

const buildState = (el: HTMLElement) =>
  EditorState.create({
    doc: parseElement(el),
    plugins: [
      history(),
      markKeymap(),
      blockInputRules(),
      listKeymap(),
      keymap(baseKeymap),
    ],
  })

/** GrapesJS plugin: swap the RTE engine for ProseMirror. */
export const rtePlugin: Plugin = (editor: Editor) => {
  editor.setCustomRte<Rte>({
    // Store returned HTML as Components (like the native engine) rather than an
    // opaque string, so text content round-trips through the project JSON /
    // react-renderer pipeline the same way it did before.
    parseContent: true,

    enable(el, view, opts) {
      // Scope the rich engine to the `rich-text` block. Everything else
      // (default Text block, headings, buttons, links, …) edits as plain
      // `contenteditable` with no toolbar — no ProseMirror, no `tc-rte:*`
      // events, so <RteToolbar> never shows. `opts.view.model` is the edited
      // component (getEditing() isn't set yet at this point).
      const comp = opts?.view?.model ?? editor.getEditing()
      if (!usesProseMirror(comp)) {
        if (!isPlain(view)) el.contentEditable = "true"
        el.focus()
        return { __tcPlain: true }
      }

      // Re-focus the live editor if we're already mounted on this element.
      const existing = elToEntry.get(el)
      if (existing) {
        existing.view.focus()
        return existing.view
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
      const component = (opts?.view?.model ??
        editor.getEditing()) as Component
      elToEntry.set(el, {
        view: created,
        component,
        initialDoc: created.state.doc,
      })
      created.focus()
      editor.trigger(RTE_EVENTS.enable, { view: created, component })
      return created
    },

    disable(el, view) {
      // Plain branch: just drop editability — nothing was emptied.
      if (isPlain(view)) {
        el.removeAttribute("contenteditable")
        return
      }
      const entry = elToEntry.get(el)
      if (!entry) return
      editor.trigger(RTE_EVENTS.disable)
      const changed = docChanged(el)
      elToEntry.delete(el)
      // Destroying the mounted view empties the element. When the content
      // changed, `forceSync` makes GrapesJS rebuild the component from it and
      // repaint. When it didn't, GrapesJS skips its sync (no churn) — so we
      // repaint by re-mounting the component's React element from its unchanged
      // model, once GrapesJS has finished the disable pass. We use the
      // bump-key-only repaint event (NOT `rerender`): `rerender` would fire the
      // React renderer's synchronous `view.remove()`, which races the DOM
      // ProseMirror just destroyed (`Node.removeChild: not a child`).
      if (!changed) {
        editor.once(editor.RichTextEditor.events.disable, () =>
          entry.component.trigger(RTE_REPAINT_EVENT)
        )
      }
      entry.view.destroy()
      el.removeAttribute("contenteditable")
      return { forceSync: changed }
    },

    getContent(el, view, opts) {
      // Plain branch: the DOM is the source of truth (native-engine behavior).
      if (isPlain(view)) return el.innerHTML
      const entry = elToEntry.get(el)
      // No live entry (post-disable pass): fall back to the DOM.
      if (!entry) return el.innerHTML
      // Unchanged → hand back GrapesJS' own recorded content so its
      // `content === lastContent` check skips the sync (no churn). Changed →
      // serialize the current doc.
      if (!docChanged(el)) {
        const last = (opts as { view?: { lastContent?: string } } | undefined)
          ?.view?.lastContent
        return last ?? serializeDoc(entry.view.state.doc)
      }
      return serializeDoc(entry.view.state.doc)
    },
  })
}

export default rtePlugin
