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
 * Remove `property` from every descendant `<span>` of `el`, unwrapping any
 * span left with no inline style. Without this a superset `<span>` (e.g.
 * `font-size: large`) is overridden by a stale inner `<span>` from an earlier
 * apply (`font-size: small`) — the runaway-nesting bug.
 */
const stripDescendantProperty = (el: HTMLElement, property: string): void => {
  for (const span of Array.from(el.querySelectorAll("span"))) {
    span.style.removeProperty(property)
    if (span.getAttribute("style")?.trim()) continue
    const parent = span.parentNode
    if (!parent) continue
    while (span.firstChild) parent.insertBefore(span.firstChild, span)
    parent.removeChild(span)
  }
}

/** The single `<span>` a fragment consists of, if that's all it is. */
const loneSpan = (frag: DocumentFragment): HTMLElement | null => {
  if (frag.childNodes.length !== 1) return null
  const only = frag.firstChild
  return only && only.nodeType === 1 && (only as Element).tagName === "SPAN"
    ? (only as HTMLElement)
    : null
}

/**
 * The `<span>` the selection covers exactly — either an ancestor whose text is
 * the whole selection, or a single selected `<span>` node — so a re-apply
 * updates it in place. Null when the selection isn't a clean span boundary.
 */
export const exactWrappingSpan = (
  rte: Rte,
  range: Range
): HTMLElement | null => {
  const selected = range.toString()
  if (!selected) return null

  // The range selects exactly one child node and it's a span (this is the
  // shape left behind right after `insertHTML`, where the boundaries sit in
  // the parent around the inserted span).
  const { startContainer, endContainer, startOffset, endOffset } = range
  if (
    startContainer === endContainer &&
    startContainer.nodeType === 1 &&
    endOffset - startOffset === 1
  ) {
    const only = startContainer.childNodes[startOffset]
    if (only && only.nodeType === 1 && (only as Element).tagName === "SPAN") {
      return only as HTMLElement
    }
  }

  // An ancestor span whose entire text is the selection (the caret sits inside
  // the span and covers all of it).
  let node: Node | null = range.commonAncestorContainer
  if (node.nodeType === 3) node = node.parentNode
  while (node && node !== rte.el) {
    if (
      node.nodeType === 1 &&
      (node as Element).tagName === "SPAN" &&
      node.textContent === selected
    ) {
      return node as HTMLElement
    }
    node = node.parentNode
  }
  return null
}

/**
 * Apply one inline style declaration to the selection.
 *
 * Unlike `wrapSelection`, this does not blindly nest a new `<span>` on every
 * call: if the selection already maps to a wrapping span it mutates it in
 * place, and it merges onto a lone selected span rather than wrapping it. In
 * all cases it strips the same property from descendant spans so the value it
 * sets actually wins the cascade.
 */
export const applyInlineStyle = (
  rte: Rte,
  property: string,
  value: string
): boolean => {
  const range = currentRange(rte)
  if (!range || range.collapsed) return false

  const existing = exactWrappingSpan(rte, range)
  if (existing) {
    existing.style.setProperty(property, value)
    stripDescendantProperty(existing, property)
    return true
  }

  const frag = range.extractContents()
  // Reuse a lone selected span so a second property (e.g. colour after size)
  // merges onto one span instead of nesting a second.
  const lone = loneSpan(frag)
  const span = lone ?? rte.doc.createElement("span")
  if (!lone) span.appendChild(frag)
  span.style.setProperty(property, value)
  stripDescendantProperty(span, property)
  rte.insertHTML(span)
  return true
}

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
