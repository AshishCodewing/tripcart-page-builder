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
//
// Every editable component now routes through ProseMirror. The Rich Text block
// uses the full block schema; every other editable leaf (default Text block,
// headings, buttons, links) uses the inline schema (`inline: true` on the entry
// and the enable event) with an inline-only toolbar. Because ProseMirror owns
// the mounted element's DOM, leaf editing no longer touches bare
// `contenteditable`, avoiding the React-reconcile-over-mutated-DOM corruption
// the old plain branch suffered.

import type { Component, Editor, Plugin } from "grapesjs"
import { baseKeymap, toggleMark } from "prosemirror-commands"
import { history, redo, undo } from "prosemirror-history"
import {
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule,
} from "prosemirror-inputrules"
import { keymap } from "prosemirror-keymap"
import type { Node as PMNode, Schema } from "prosemirror-model"
import {
  liftListItem,
  sinkListItem,
  splitListItem,
} from "prosemirror-schema-list"
import { EditorState } from "prosemirror-state"
import { EditorView } from "prosemirror-view"

import { RTE_REPAINT_EVENT } from "@/lib/plugins/react-renderer"

import { insertHardBreak } from "./commands"
import { RICH_TEXT_TYPE } from "./rich-text-block"
import {
  inlineSchema,
  parseElement,
  parseInlineElement,
  schema,
  serializeDoc,
  serializeInlineDoc,
} from "./schema"

/** Per-element editing state, keyed by the mounted DOM element. */
type RteEntry = {
  view: EditorView
  component: Component
  /** The doc the session started from, for structural change detection. */
  initialDoc: PMNode
  /** Leaf (inline schema) vs the Rich Text block (block schema). */
  inline: boolean
}

const elToEntry = new WeakMap<HTMLElement, RteEntry>()

type Rte = EditorView

/**
 * Whether the component being edited is the Rich Text block. GrapesJS routes
 * every text edit through the single custom-RTE object; the Rich Text block
 * gets the full block schema, every other editable leaf (links, headings,
 * buttons, the plain Text block) gets the inline schema (see rich-text-block.ts).
 */
const isRichTextBlock = (comp: { get?: (k: string) => unknown } | undefined) =>
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

// Mark-toggle + history shortcuts. Resolves marks off the passed schema so it
// works for both the block and inline schemas (distinct Schema instances, so
// their MarkType objects aren't interchangeable).
const markKeymap = (sch: Schema = schema) =>
  keymap({
    "Mod-b": toggleMark(sch.marks.strong),
    "Mod-i": toggleMark(sch.marks.em),
    "Mod-u": toggleMark(sch.marks.underline),
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

// Inline leaf state: no list/block input rules or list keymap (those reference
// nodes absent from `inlineSchema` and would throw at plugin construction).
// Enter/Shift-Enter insert a `<br>` so line breaks never create block structure.
const buildInlineState = (el: HTMLElement) =>
  EditorState.create({
    schema: inlineSchema,
    doc: parseInlineElement(el),
    plugins: [
      history(),
      markKeymap(inlineSchema),
      keymap({ Enter: insertHardBreak, "Shift-Enter": insertHardBreak }),
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
      // Every editable component edits through ProseMirror. The Rich Text block
      // gets the full block schema (paragraphs / headings / lists); every other
      // editable leaf (default Text block, headings, buttons, links, …) gets the
      // inline schema and an inline-only toolbar. `opts.view.model` is the edited
      // component (getEditing() isn't set yet at this point).
      const comp = opts?.view?.model ?? editor.getEditing()
      const inline = !isRichTextBlock(comp)

      // Re-focus the live editor if we're already mounted on this element.
      const existing = elToEntry.get(el)
      if (existing) {
        existing.view.focus()
        return existing.view
      }

      const created: EditorView = new EditorView(
        { mount: el },
        {
          state: inline ? buildInlineState(el) : buildState(el),
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
        inline,
      })
      created.focus()
      editor.trigger(RTE_EVENTS.enable, { view: created, component, inline })
      return created
    },

    disable(el) {
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

    getContent(el, _view, opts) {
      const entry = elToEntry.get(el)
      // No live entry (post-disable pass): fall back to the DOM.
      if (!entry) return el.innerHTML
      const serialize = entry.inline ? serializeInlineDoc : serializeDoc
      // Unchanged → hand back GrapesJS' own recorded content so its
      // `content === lastContent` check skips the sync (no churn). Changed →
      // serialize the current doc.
      if (!docChanged(el)) {
        const last = (opts as { view?: { lastContent?: string } } | undefined)
          ?.view?.lastContent
        return last ?? serialize(entry.view.state.doc)
      }
      return serialize(entry.view.state.doc)
    },
  })
}

export default rtePlugin
