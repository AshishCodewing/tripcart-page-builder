// The command + state layer the toolbar drives. Everything here is a pure
// function over an EditorState / EditorView — no DOM walking, no execCommand.
//
// A command is applied with `runCmd(view, cmd)`, which focuses the view first:
// opening a select/popover moves DOM focus into the top document, but the
// ProseMirror selection lives in `view.state`, so re-focusing and dispatching
// is all that's needed (this replaces the old capture/restore-range dance).

import { setBlockType, toggleMark, wrapIn } from "prosemirror-commands"
import { redo, undo } from "prosemirror-history"
import {
  liftListItem,
  sinkListItem,
  wrapInList,
} from "prosemirror-schema-list"
import {
  type Command,
  type EditorState,
  type Transaction,
} from "prosemirror-state"
import type { MarkType, NodeType } from "prosemirror-model"
import type { EditorView } from "prosemirror-view"

import { ALIGNMENTS, schema, type TextStyleAttr } from "./schema"

const { marks, nodes } = schema

/** Focus the view and run a ProseMirror command against its current state. */
export const runCmd = (view: EditorView, cmd: Command): boolean => {
  view.focus()
  return cmd(view.state, view.dispatch)
}

// --- inline marks ---------------------------------------------------------

/** The mark types the inline toggles map to. */
export const MARK_COMMANDS: Record<string, MarkType> = {
  bold: marks.strong,
  italic: marks.em,
  underline: marks.underline,
  strikethrough: marks.strikethrough,
  subscript: marks.subscript,
  superscript: marks.superscript,
  code: marks.code,
}

export const toggleInlineMark = (type: MarkType): Command => toggleMark(type)

/** Whether `type` is active on the current selection (or stored marks). */
export const markActive = (state: EditorState, type: MarkType): boolean => {
  const { from, $from, to, empty } = state.selection
  if (empty) return !!type.isInSet(state.storedMarks || $from.marks())
  return state.doc.rangeHasMark(from, to, type)
}

// --- block format ---------------------------------------------------------

/** setBlockType/wrapIn command for a BLOCK_FORMATS tag. */
export const setBlockFormat = (tag: string): Command => {
  if (tag === "blockquote") return wrapIn(nodes.blockquote)
  if (tag === "pre") return setBlockType(nodes.code_block)
  if (tag === "p") return setBlockType(nodes.paragraph)
  const m = /^h([1-6])$/.exec(tag)
  if (m) return setBlockType(nodes.heading, { level: Number(m[1]) })
  return () => false
}

/** The active block's BLOCK_FORMATS tag (`""` when it's none of them). */
export const blockFormat = (state: EditorState): string => {
  const { $from } = state.selection
  // Walk from the selection's textblock up to the doc, first recognized wins.
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type === nodes.heading) return `h${node.attrs.level}`
    if (node.type === nodes.code_block) return "pre"
    if (node.type === nodes.paragraph) return "p"
    if (node.type === nodes.blockquote) return "blockquote"
  }
  return ""
}

// --- lists ----------------------------------------------------------------

const inNodeType = (state: EditorState, type: NodeType): boolean => {
  const { $from } = state.selection
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === type) return true
  }
  return false
}

export const listActive = (state: EditorState, ordered: boolean): boolean =>
  inNodeType(state, ordered ? nodes.ordered_list : nodes.bullet_list)

/** Toggle a list: lift out if already inside one, otherwise wrap. */
export const toggleList = (ordered: boolean): Command => {
  const listType = ordered ? nodes.ordered_list : nodes.bullet_list
  return (state, dispatch, view) => {
    if (listActive(state, ordered)) {
      return liftListItem(nodes.list_item)(state, dispatch, view)
    }
    return wrapInList(listType)(state, dispatch, view)
  }
}

// --- indent / outdent -----------------------------------------------------

/**
 * Adjust indent. Inside a list this sinks/lifts the list item; otherwise it
 * bumps the `indent` attr on every selected top-level block.
 */
export const indent = (delta: 1 | -1): Command => {
  return (state, dispatch, view) => {
    if (inNodeType(state, nodes.list_item)) {
      const cmd =
        delta > 0 ? sinkListItem(nodes.list_item) : liftListItem(nodes.list_item)
      return cmd(state, dispatch, view)
    }
    return setBlockAttr("indent", (current) =>
      Math.max(0, ((current as number) || 0) + delta)
    )(state, dispatch)
  }
}

// --- alignment ------------------------------------------------------------

export const setAlign = (align: (typeof ALIGNMENTS)[number]): Command =>
  setBlockAttr("align", (current) => (current === align ? null : align))

export const alignActive = (
  state: EditorState,
  align: (typeof ALIGNMENTS)[number]
): boolean => {
  const { $from } = state.selection
  const block = $from.node($from.depth)
  return block?.attrs?.align === align
}

/**
 * Set an attribute on every block touched by the selection that actually
 * declares it (paragraph / heading). `next` receives the current value.
 */
const setBlockAttr = (
  attr: "align" | "indent",
  next: (current: unknown) => unknown
): Command => {
  return (state, dispatch) => {
    const { from, to } = state.selection
    let tr: Transaction | null = null
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.isTextblock && attr in node.type.spec.attrs!) {
        tr = (tr || state.tr).setNodeMarkup(pos, undefined, {
          ...node.attrs,
          [attr]: next(node.attrs[attr]),
        })
      }
    })
    if (!tr) return false
    if (dispatch) dispatch(tr)
    return true
  }
}

// --- link -----------------------------------------------------------------

export type LinkAttrs = {
  href: string | null
  title: string | null
  target: string | null
  rel: string | null
}

/** The link mark covering the caret, if any (for prefilling the popover). */
export const linkAt = (state: EditorState): LinkAttrs | null => {
  const { $from } = state.selection
  const mark = marks.link.isInSet($from.marks())
  return mark ? (mark.attrs as LinkAttrs) : null
}

/** Apply a link across the selection, or over the given text when collapsed. */
export const applyLink = (
  view: EditorView,
  attrs: LinkAttrs,
  fallbackText?: string
): void => {
  view.focus()
  const { state } = view
  const { from, to, empty } = state.selection
  const mark = marks.link.create(attrs)
  if (!empty) {
    view.dispatch(state.tr.addMark(from, to, mark))
    return
  }
  const text = fallbackText || attrs.href
  if (!text) return
  const node = state.schema.text(text, [mark])
  view.dispatch(state.tr.replaceSelectionWith(node, false))
}

/** Remove any link mark under/around the caret. */
export const removeLink: Command = (state, dispatch) => {
  const { from, to, empty } = state.selection
  const range = empty ? markRange(state, marks.link) : { from, to }
  if (!range) return false
  if (dispatch) dispatch(state.tr.removeMark(range.from, range.to, marks.link))
  return true
}

/** The full span a mark covers around a collapsed caret. */
const markRange = (state: EditorState, type: MarkType) => {
  const { $from } = state.selection
  if (!type.isInSet($from.marks())) return null
  const parent = $from.parent
  const index = $from.index()
  let start = $from.pos - $from.textOffset
  let startIndex = index
  while (startIndex > 0 && type.isInSet(parent.child(startIndex - 1).marks)) {
    startIndex--
    start -= parent.child(startIndex).nodeSize
  }
  let end = start
  let endIndex = startIndex
  while (endIndex < parent.childCount && type.isInSet(parent.child(endIndex).marks)) {
    end += parent.child(endIndex).nodeSize
    endIndex++
  }
  return { from: start, to: end }
}

// --- text style (color / bg / font) --------------------------------------

/**
 * Merge one style property onto the `textStyle` mark across the selection.
 * Because it's a single mark, a second property (colour after size) updates
 * the same span rather than nesting a new one — the parity fix for the old
 * runaway-`<span>` bug.
 */
export const applyTextStyle = (
  view: EditorView,
  attr: TextStyleAttr,
  value: string
): void => {
  view.focus()
  const { state } = view
  const { from, to, empty, $from } = state.selection
  const type = marks.textStyle
  // Merge onto whatever style mark already sits at the caret / selection start.
  const marksHere = empty ? state.storedMarks || $from.marks() : $from.marks()
  const existing = type.isInSet(marksHere)
  const attrs = { ...(existing?.attrs || {}), [attr]: value }
  const mark = type.create(attrs)
  if (empty) {
    view.dispatch(state.tr.addStoredMark(mark))
    return
  }
  const tr = state.tr.removeMark(from, to, type).addMark(from, to, mark)
  view.dispatch(tr)
}

// --- misc -----------------------------------------------------------------

export const insertHorizontalRule: Command = (state, dispatch) => {
  if (dispatch)
    dispatch(state.tr.replaceSelectionWith(nodes.horizontal_rule.create()))
  return true
}

/** Clear all inline marks over the selection and reset the block to paragraph. */
export const removeFormat: Command = (state, dispatch) => {
  const { from, to, empty } = state.selection
  if (empty) return false
  let tr = state.tr.removeMark(from, to)
  const range = { from, to }
  if (dispatch) {
    // Reset touched textblocks to plain paragraphs (drops align/indent too).
    const positions: number[] = []
    tr.doc.nodesBetween(range.from, range.to, (node, pos) => {
      if (node.isTextblock && node.type !== nodes.paragraph) positions.push(pos)
    })
    for (const pos of positions.reverse()) {
      tr = tr.setNodeMarkup(pos, nodes.paragraph, null)
    }
    dispatch(tr.scrollIntoView())
  }
  return true
}

export const undoCmd = undo
export const redoCmd = redo
