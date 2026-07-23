// Selection helpers shared by the RTE toolbar. Everything here operates on the
// canvas iframe's document via the live `RichTextEditor` instance — never the
// top document.

import type { Editor } from "grapesjs"

/**
 * The built-in RTE instance. GrapesJS declares the `RichTextEditor` class but
 * doesn't export the type, so we reach it through the module's `globalRte`.
 * It arrives in React via the `rte:enable` event.
 */
export type Rte = NonNullable<Editor["RichTextEditor"]["globalRte"]>

/**
 * The live selection range, but only when it actually sits inside the element
 * being edited. Clicking around the editor chrome can leave a stale range
 * pointing elsewhere in the frame.
 */
export const currentRange = (rte: Rte): Range | null => {
  const sel = rte.doc.getSelection()
  if (!sel?.rangeCount) return null
  const range = sel.getRangeAt(0)
  return rte.el.contains(range.commonAncestorContainer) ? range : null
}

export const captureRange = (rte: Rte): Range | null =>
  currentRange(rte)?.cloneRange() ?? null

/**
 * Re-focus the contenteditable and restore `range`.
 *
 * Controls that open a popup (colour picker, the selects) move focus into the
 * top document, and `document.execCommand` only acts on a focused document —
 * without this the command silently does nothing.
 */
export const restoreRange = (rte: Rte, range: Range | null) => {
  const sel = rte.doc.getSelection()
  if (!sel || !range) return
  rte.el.focus()
  sel.removeAllRanges()
  sel.addRange(range)
}

/**
 * Wrap the current selection in `tagName`, letting `apply` set attributes/
 * styles on the new element. Returns false when there's nothing to wrap.
 *
 * `range.extractContents()` keeps nested markup intact — GrapesJS's own `link`
 * / `wrap` actions interpolate `rte.selection()`, which stringifies to plain
 * text and drops any `<b>`/`<a>` inside the selection.
 *
 * `insertHTML` is deliberately called WITHOUT `{ select: true }`: that option
 * fires `model.trigger("disable")` and ends the editing session (which is why
 * the built-in link/wrap actions close the RTE).
 */
export const wrapSelectionEl = (
  rte: Rte,
  tagName: string,
  apply: (el: HTMLElement) => void
): boolean => {
  const range = currentRange(rte)
  if (!range || range.collapsed) return false
  const el = rte.doc.createElement(tagName)
  apply(el)
  el.appendChild(range.extractContents())
  rte.insertHTML(el)
  return true
}

/** Wrap the selection in a styled `<span>`. */
export const wrapSelection = (
  rte: Rte,
  apply: (span: HTMLSpanElement) => void
): boolean =>
  wrapSelectionEl(rte, "span", apply as (el: HTMLElement) => void)

/**
 * The `<a>` enclosing the selection (or `range`), or null. Walks up to
 * `rte.el`. Uses a tag-name check rather than `instanceof HTMLAnchorElement`:
 * the node lives in the canvas iframe, whose `HTMLAnchorElement` is a
 * different constructor than the top window's, so `instanceof` would miss.
 */
export const findAnchor = (
  rte: Rte,
  range?: Range | null
): HTMLElement | null => {
  const r = range ?? currentRange(rte)
  if (!r) return null
  let node: Node | null = r.commonAncestorContainer
  while (node && node !== rte.el) {
    if (node.nodeType === 1 && (node as Element).tagName === "A") {
      return node as HTMLElement
    }
    node = node.parentNode
  }
  return null
}

/** Unwrap an `<a>` in place, keeping its children (the "remove link" action). */
export const unlinkAt = (anchor: HTMLElement): void => {
  const parent = anchor.parentNode
  if (!parent) return
  while (anchor.firstChild) parent.insertBefore(anchor.firstChild, anchor)
  parent.removeChild(anchor)
}

/** Block formats offered by the format dropdown, in menu order. */
export const BLOCK_FORMATS = [
  { tag: "p", label: "Paragraph" },
  { tag: "h1", label: "Heading 1" },
  { tag: "h2", label: "Heading 2" },
  { tag: "h3", label: "Heading 3" },
  { tag: "h4", label: "Heading 4" },
  { tag: "h5", label: "Heading 5" },
  { tag: "h6", label: "Heading 6" },
  { tag: "blockquote", label: "Quote" },
  { tag: "pre", label: "Code" },
] as const

const BLOCK_TAGS: readonly string[] = BLOCK_FORMATS.map((f) => f.tag)

/**
 * `queryCommandValue("formatBlock")` reports the block ancestor's tag, but the
 * casing varies by engine and it yields `""` / `"false"` when the caret has no
 * block ancestor (or the command isn't supported). Normalize to one of
 * BLOCK_FORMATS, or `""` when there's nothing to show.
 */
export const normalizeBlockFormat = (value: string | boolean): string => {
  if (typeof value !== "string") return ""
  const tag = value.trim().toLowerCase().replace(/^<|>$/g, "")
  if (!tag || tag === "false") return ""
  // Some engines report `div` for an unstyled block — treat it as no format
  // rather than surfacing a menu entry that doesn't exist.
  return BLOCK_TAGS.includes(tag) ? tag : ""
}

/** `formatBlock` takes the tag in angle brackets (`<h2>`). */
export const applyBlockFormat = (rte: Rte, tag: string) => {
  rte.exec("formatBlock", `<${tag}>`)
}

export const readBlockFormat = (rte: Rte): string => {
  try {
    return normalizeBlockFormat(rte.doc.queryCommandValue("formatBlock"))
  } catch {
    return ""
  }
}
