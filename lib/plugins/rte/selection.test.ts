// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest"

import {
  currentRange,
  findAnchor,
  normalizeBlockFormat,
  unlinkAt,
  wrapSelection,
  wrapSelectionEl,
  type Rte,
} from "./selection"

/**
 * Minimal stand-in for GrapesJS' RichTextEditor. `insertHTML` mirrors the real
 * implementation (delete the range's contents, insert the node, re-select) —
 * that's the only method wrapSelection leans on.
 */
const makeRte = (html: string) => {
  const el = document.createElement("div")
  el.contentEditable = "true"
  el.innerHTML = html
  document.body.append(el)

  const rte = {
    el,
    doc: document,
    insertHTML: (value: string | HTMLElement) => {
      const sel = document.getSelection()
      if (!sel?.rangeCount) return
      const range = sel.getRangeAt(0)
      range.deleteContents()
      if (typeof value === "string") {
        const holder = document.createElement("div")
        holder.innerHTML = value
        for (const node of Array.from(holder.childNodes)) {
          range.insertNode(node)
        }
      } else {
        range.insertNode(value)
      }
      sel.removeAllRanges()
      sel.addRange(range)
    },
  } as unknown as Rte

  return { rte, el }
}

/** Select everything inside `el`. */
const selectAll = (el: HTMLElement) => {
  const range = document.createRange()
  range.selectNodeContents(el)
  const sel = document.getSelection()!
  sel.removeAllRanges()
  sel.addRange(range)
}

describe("wrapSelection", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("wraps the selection in a styled span", () => {
    const { rte, el } = makeRte("hello world")
    selectAll(el)

    const applied = wrapSelection(rte, (span) =>
      span.style.setProperty("color", "var(--tc--preset--color--primary)")
    )

    expect(applied).toBe(true)
    const span = el.querySelector("span")!
    expect(span.getAttribute("style")).toContain(
      "var(--tc--preset--color--primary)"
    )
    expect(span.textContent).toBe("hello world")
  })

  it("preserves nested markup inside the selection", () => {
    const { rte, el } = makeRte('go <b>bold</b> and <a href="#">link</a>')
    selectAll(el)

    wrapSelection(rte, (span) => span.style.setProperty("font-size", "2rem"))

    const span = el.querySelector("span")!
    expect(span.querySelector("b")?.textContent).toBe("bold")
    expect(span.querySelector("a")?.getAttribute("href")).toBe("#")
  })

  it("is a no-op on a collapsed selection", () => {
    const { rte, el } = makeRte("hello")
    const range = document.createRange()
    range.setStart(el.firstChild!, 2)
    range.collapse(true)
    const sel = document.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    expect(wrapSelection(rte, (span) => span.classList.add("x"))).toBe(false)
    expect(el.querySelector("span")).toBeNull()
  })

  it("ignores a selection outside the edited element", () => {
    const { rte } = makeRte("hello")
    const other = document.createElement("p")
    other.textContent = "elsewhere"
    document.body.append(other)
    selectAll(other)

    expect(currentRange(rte)).toBeNull()
    expect(wrapSelection(rte, (span) => span.classList.add("x"))).toBe(false)
  })
})

describe("link helpers", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("wraps a selection in an anchor with attributes", () => {
    const { rte, el } = makeRte("visit us")
    selectAll(el)

    wrapSelectionEl(rte, "a", (a) => {
      a.setAttribute("href", "https://example.com")
      a.setAttribute("target", "_blank")
    })

    const anchor = el.querySelector("a")!
    expect(anchor.getAttribute("href")).toBe("https://example.com")
    expect(anchor.getAttribute("target")).toBe("_blank")
    expect(anchor.textContent).toBe("visit us")
  })

  it("finds the anchor enclosing a collapsed caret", () => {
    const { rte, el } = makeRte('go <a href="#">here</a> now')
    const anchorEl = el.querySelector("a")!
    const range = document.createRange()
    range.setStart(anchorEl.firstChild!, 2)
    range.collapse(true)
    const sel = document.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    expect(findAnchor(rte)).toBe(anchorEl)
  })

  it("returns null when the caret is outside any anchor", () => {
    const { rte, el } = makeRte('go <a href="#">here</a> now')
    const range = document.createRange()
    range.setStart(el.lastChild!, 1)
    range.collapse(true)
    const sel = document.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    expect(findAnchor(rte)).toBeNull()
  })

  it("unwraps an anchor while keeping its children", () => {
    const { rte, el } = makeRte('go <a href="#"><b>here</b></a> now')
    const anchorEl = el.querySelector("a")!

    unlinkAt(anchorEl)

    expect(el.querySelector("a")).toBeNull()
    expect(el.querySelector("b")?.textContent).toBe("here")
    expect(el.textContent).toBe("go here now")
    // Silence unused-var lint for the shared rte handle.
    expect(rte.el).toBe(el)
  })
})

describe("normalizeBlockFormat", () => {
  it("normalizes casing and angle brackets", () => {
    expect(normalizeBlockFormat("H2")).toBe("h2")
    expect(normalizeBlockFormat("<blockquote>")).toBe("blockquote")
  })

  it("returns empty for the no-block-ancestor reports", () => {
    expect(normalizeBlockFormat("")).toBe("")
    expect(normalizeBlockFormat("false")).toBe("")
    expect(normalizeBlockFormat("div")).toBe("")
    expect(normalizeBlockFormat(false)).toBe("")
  })
})
