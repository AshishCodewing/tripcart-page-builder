// RTE actions ported from `grapesjs-rte-extensions` (MIT, Brendon Ngirazi).
//
// The upstream package couldn't be used as-is: with `richTextEditor.custom`
// enabled GrapesJS never builds the action buttons, and four of its actions are
// written against that DOM (`fontName`/`fontSize` read `action.btn.firstChild`,
// `fontColor`/`hilite` construct a colour picker from a `<div>` that only
// exists inside their icon HTML — that one throws). What's left is this list of
// `rte.exec()` one-liners, which is what we keep.
//
// Two deliberate differences from upstream:
//   - Action names are the execCommand names (`insertOrderedList`, not
//     `olist`). GrapesJS resolves a button's active state with
//     `doc.queryCommandSupported(name) && doc.queryCommandState(name)`, so
//     matching names gives us toggle highlighting with no `state` function.
//   - No `icon` HTML. Upstream ships FontAwesome markup; our toolbar renders
//     lucide icons in React, so `icon` is the empty string GrapesJS never uses.

import type { Editor, RichTextEditorAction } from "grapesjs"

import type { Rte } from "./selection"

/** Mirrors GrapesJS' internal `btnState` enum (not exported). */
export const RTE_STATE = {
  ACTIVE: 1,
  INACTIVE: 0,
  DISABLED: -1,
} as const

/**
 * Action names, grouped the way the toolbar lays them out. The first group is
 * GrapesJS' own default set (`richTextEditor.actions`) — those are registered
 * by the core, we only reference them.
 */
export const RTE_ACTIONS = {
  inline: ["bold", "italic", "underline", "strikethrough"],
  script: ["subscript", "superscript"],
  link: ["link", "wrap"],
  list: ["insertOrderedList", "insertUnorderedList"],
  indent: ["indent", "outdent"],
  align: ["justifyLeft", "justifyCenter", "justifyRight", "justifyFull"],
  insert: ["insertHorizontalRule", "removeFormat"],
  clipboard: ["copy", "cut", "paste", "delete"],
  history: ["undo", "redo"],
} as const

type RteActionDef = {
  name: string
  title: string
  result: (rte: Rte) => void
  state?: RichTextEditorAction["state"]
}

const exec =
  (command: string) =>
  (rte: Rte): void =>
    rte.exec(command)

/**
 * `execCommand("paste")` is blocked in Chrome (it returns false and does
 * nothing), so go through the async clipboard API and fall back to the
 * command for engines that still allow it. Reading the clipboard may prompt
 * for permission the first time.
 */
const paste = (rte: Rte): void => {
  let read: Promise<string> | undefined
  try {
    read = navigator.clipboard?.readText()
  } catch {
    read = undefined
  }
  if (!read) {
    rte.exec("paste")
    return
  }
  void read.then(
    (text) => {
      if (text) rte.exec("insertText", text)
    },
    () => rte.exec("paste")
  )
}

/**
 * Grey out undo/redo when the contenteditable's own history stack is empty.
 * `queryCommandEnabled` throws in some engines when the document isn't
 * focused, so treat a throw as "not disabled" rather than losing the button.
 */
const historyState =
  (command: string): RichTextEditorAction["state"] =>
  (_rte, doc) => {
    try {
      return doc.queryCommandEnabled(command)
        ? RTE_STATE.INACTIVE
        : RTE_STATE.DISABLED
    } catch {
      return RTE_STATE.INACTIVE
    }
  }

/**
 * Everything registered on top of the GrapesJS defaults. `bold` / `italic` /
 * `underline` / `strikethrough` / `link` / `wrap` are core actions — adding
 * them again would duplicate them in `getAll()`.
 */
export const PORTED_ACTIONS: RteActionDef[] = [
  { name: "subscript", title: "Subscript", result: exec("subscript") },
  { name: "superscript", title: "Superscript", result: exec("superscript") },
  {
    name: "insertOrderedList",
    title: "Numbered list",
    result: exec("insertOrderedList"),
  },
  {
    name: "insertUnorderedList",
    title: "Bulleted list",
    result: exec("insertUnorderedList"),
  },
  { name: "indent", title: "Indent", result: exec("indent") },
  { name: "outdent", title: "Outdent", result: exec("outdent") },
  { name: "justifyLeft", title: "Align left", result: exec("justifyLeft") },
  {
    name: "justifyCenter",
    title: "Align center",
    result: exec("justifyCenter"),
  },
  { name: "justifyRight", title: "Align right", result: exec("justifyRight") },
  { name: "justifyFull", title: "Justify", result: exec("justifyFull") },
  {
    name: "insertHorizontalRule",
    title: "Horizontal line",
    result: exec("insertHorizontalRule"),
  },
  {
    name: "removeFormat",
    title: "Clear formatting",
    result: exec("removeFormat"),
  },
  { name: "copy", title: "Copy", result: exec("copy") },
  { name: "cut", title: "Cut", result: exec("cut") },
  { name: "paste", title: "Paste", result: paste },
  { name: "delete", title: "Delete", result: exec("delete") },
  {
    name: "undo",
    title: "Undo",
    result: exec("undo"),
    state: historyState("undo"),
  },
  {
    name: "redo",
    title: "Redo",
    result: exec("redo"),
    state: historyState("redo"),
  },
]

/**
 * `RichTextEditor.add()` forwards to `globalRte.addAction()`, so it no-ops
 * until the module's `onLoad` has built the global instance — hence the
 * `onReady` wrapper (the upstream plugin does the same).
 */
export const registerRteActions = (editor: Editor) => {
  editor.onReady(() => {
    const rte = editor.RichTextEditor
    const existing = new Set(rte.getAll().map((a) => a.name))
    for (const { name, title, result, state } of PORTED_ACTIONS) {
      if (existing.has(name)) continue
      rte.add(name, {
        // Unused under a custom UI, but required by the action type.
        icon: "",
        attributes: { title },
        result: result as RichTextEditorAction["result"],
        ...(state ? { state } : {}),
      })
    }
  })
}
