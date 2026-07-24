// @vitest-environment jsdom

import { EditorState, TextSelection } from "prosemirror-state"
import { describe, expect, it } from "vitest"

import {
  alignActive,
  applyLink,
  applyTextStyle,
  blockFormat,
  indent,
  insertHardBreak,
  insertHorizontalRule,
  linkAt,
  listActive,
  markActive,
  removeFormat,
  removeLink,
  runCmd,
  setAlign,
  setBlockFormat,
  toggleInlineMark,
  toggleList,
} from "./commands"
import { inlineSchema, parseElement, schema, serializeDoc } from "./schema"

/** Build a state from an HTML fragment, selecting `from`..`to` if given. */
const stateFrom = (html: string, from?: number, to?: number) => {
  const el = document.createElement("div")
  el.innerHTML = html
  let state = EditorState.create({ doc: parseElement(el), schema })
  if (from != null) {
    const $from = state.doc.resolve(from)
    const $to = state.doc.resolve(to ?? from)
    state = state.apply(state.tr.setSelection(new TextSelection($from, $to)))
  }
  return state
}

/** Apply a command and return the resulting document as HTML. */
const applyCmd = (state: EditorState, cmd: Parameters<typeof runCmd>[1]) => {
  let next = state
  cmd(state, (tr) => (next = state.apply(tr)))
  return { state: next, html: serializeDoc(next.doc) }
}

/**
 * Collapse inline-style whitespace so comparisons don't depend on the DOM's
 * `prop: value;` normalization (`text-align: center;` → `text-align:center`).
 */
const norm = (html: string) =>
  html.replace(/:\s+/g, ":").replace(/;\s*/g, ";").replace(/;"/g, '"')

/** Select the entire first textblock (offset 1 to end of its text). */
const selectFirstBlock = (state: EditorState) => {
  const block = state.doc.child(0)
  const $from = state.doc.resolve(1)
  const $to = state.doc.resolve(1 + block.content.size)
  return state.apply(state.tr.setSelection(new TextSelection($from, $to)))
}

describe("schema round-trip", () => {
  it("preserves headings, marks and links", () => {
    const html =
      '<h2>Title</h2><p>Hello <strong>bold</strong> and <a href="/x" title="t">link</a></p>'
    expect(serializeDoc(parseElement(el(html)))).toBe(html)
  })

  it("preserves a theme-token font-size on a span", () => {
    const html =
      '<p><span style="font-size:var(--tc--preset--font-size--lg)">big</span></p>'
    expect(norm(serializeDoc(parseElement(el(html))))).toContain(
      "font-size:var(--tc--preset--font-size--lg)"
    )
  })

  it("preserves text-align on a block", () => {
    const html = '<p style="text-align:center">mid</p>'
    expect(norm(serializeDoc(parseElement(el(html))))).toContain(
      "text-align:center"
    )
  })

  it("preserves component ids and classes across the round-trip", () => {
    const html =
      '<h2 id="i1" class="hero">Title</h2>' +
      '<p id="i2">para with <a href="/x" id="i3">link</a></p>' +
      '<blockquote id="i4"><p id="i5">quote</p></blockquote>' +
      '<ul id="i6"><li id="i7"><p id="i8">item</p></li></ul>'
    const out = serializeDoc(parseElement(el(html)))
    for (const id of ["i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8"]) {
      expect(out).toContain(`id="${id}"`)
    }
    expect(out).toContain('class="hero"')
  })
})

const el = (html: string) => {
  const div = document.createElement("div")
  div.innerHTML = html
  return div
}

describe("inline marks", () => {
  it("toggles bold across a selection", () => {
    const state = selectFirstBlock(stateFrom("<p>hello</p>"))
    const { state: next, html } = applyCmd(
      state,
      toggleInlineMark(schema.marks.strong)
    )
    expect(html).toBe("<p><strong>hello</strong></p>")
    expect(markActive(selectFirstBlock(next), schema.marks.strong)).toBe(true)
  })

  it("subscript and superscript are mutually exclusive", () => {
    const sub = applyCmd(
      selectFirstBlock(stateFrom("<p>x</p>")),
      toggleInlineMark(schema.marks.subscript)
    )
    const both = applyCmd(
      selectFirstBlock(sub.state),
      toggleInlineMark(schema.marks.superscript)
    )
    expect(both.html).toBe("<p><sup>x</sup></p>")
  })
})

describe("block format", () => {
  it("reads and sets the block format", () => {
    const state = stateFrom("<p>hi</p>", 2)
    expect(blockFormat(state)).toBe("p")
    const { state: next, html } = applyCmd(state, setBlockFormat("h3"))
    expect(html).toBe("<h3>hi</h3>")
    expect(blockFormat(stateFrom("<h3>hi</h3>", 2))).toBe("h3")
    void next
  })

  it("wraps in a blockquote", () => {
    const { html } = applyCmd(
      stateFrom("<p>q</p>", 2),
      setBlockFormat("blockquote")
    )
    expect(html).toBe("<blockquote><p>q</p></blockquote>")
  })
})

describe("lists", () => {
  it("wraps a paragraph into a bullet list and detects it", () => {
    const { html } = applyCmd(stateFrom("<p>item</p>", 2), toggleList(false))
    expect(html).toBe("<ul><li><p>item</p></li></ul>")
    expect(listActive(stateFrom(html, 3), false)).toBe(true)
  })

  it("lifts a list back out when toggled again", () => {
    const wrapped = applyCmd(stateFrom("<p>item</p>", 2), toggleList(true))
    const { html } = applyCmd(stateFrom(wrapped.html, 3), toggleList(true))
    expect(html).toBe("<p>item</p>")
  })
})

describe("alignment and indent", () => {
  it("sets and reads text-align", () => {
    const { state, html } = applyCmd(
      stateFrom("<p>x</p>", 2),
      setAlign("center")
    )
    expect(norm(html)).toBe('<p style="text-align:center">x</p>')
    expect(alignActive(state, "center")).toBe(true)
  })

  it("bumps indent on a plain block", () => {
    const once = applyCmd(stateFrom("<p>x</p>", 2), indent(1))
    expect(norm(once.html)).toBe('<p style="margin-left:2em">x</p>')
    const twice = applyCmd(stateFrom(once.html, 2), indent(1))
    expect(norm(twice.html)).toBe('<p style="margin-left:4em">x</p>')
  })
})

describe("links", () => {
  it("adds a link across a selection", () => {
    const view = fakeView(selectFirstBlock(stateFrom("<p>go</p>")))
    applyLink(view, {
      href: "https://x.com",
      title: null,
      target: "_blank",
      rel: "noopener noreferrer",
    })
    expect(serializeDoc(view.state.doc)).toBe(
      '<p><a href="https://x.com" target="_blank" rel="noopener noreferrer">go</a></p>'
    )
    expect(linkAt(caretIn(view.state))?.href).toBe("https://x.com")
  })

  it("removes a link", () => {
    const html = '<p><a href="/x">go</a></p>'
    const { html: out } = applyCmd(stateFrom(html, 2), removeLink)
    expect(out).toBe("<p>go</p>")
  })
})

describe("textStyle merge", () => {
  it("merges colour after size onto one span", () => {
    const view = fakeView(selectFirstBlock(stateFrom("<p>t</p>")))
    applyTextStyle(view, "fontSize", "var(--tc--preset--font-size--lg)")
    // re-select (dispatch collapsed the selection metadata but text is same)
    view.state = selectFirstBlock(view.state)
    applyTextStyle(view, "color", "red")
    const html = serializeDoc(view.state.doc)
    expect(norm(html)).toBe(
      '<p><span style="color:red;font-size:var(--tc--preset--font-size--lg)">t</span></p>'
    )
    // exactly one span, no nesting
    expect(html.match(/<span/g)?.length).toBe(1)
  })
})

describe("removeFormat", () => {
  it("strips marks and resets the block to a paragraph", () => {
    const state = selectFirstBlock(stateFrom("<h2><strong>x</strong></h2>"))
    const { html } = applyCmd(state, removeFormat)
    expect(html).toBe("<p>x</p>")
  })
})

// --- inline schema (single-block mount) -----------------------------------
// The RTE mounts directly on a `<p>`/`<h1>`/… when the component is a leaf text
// element; `parseElement` then uses `inlineSchema`, so the document is just
// inline content and PM never nests a block inside the mounted element.

describe("inline schema", () => {
  /** Build inline-schema state from a leaf element's inner HTML. */
  const inlineState = (tag: string, html: string) => {
    const host = document.createElement(tag)
    host.innerHTML = html
    return EditorState.create({ doc: parseElement(host) })
  }
  /** Select the whole inline document. */
  const selectAll = (state: EditorState) => {
    const $from = state.doc.resolve(0)
    const $to = state.doc.resolve(state.doc.content.size)
    return state.apply(state.tr.setSelection(new TextSelection($from, $to)))
  }

  it("parses a leaf element into an inline-schema doc (no wrapping block)", () => {
    const state = inlineState("h2", "Title")
    expect(state.doc.type.schema).toBe(inlineSchema)
    expect(serializeDoc(state.doc)).toBe("Title")
  })

  it("round-trips inline marks as bare HTML, no nested block", () => {
    const state = inlineState("h1", "a <em>b</em>")
    expect(serializeDoc(state.doc)).toBe("a <em>b</em>")
  })

  it("toggles a mark over the whole element", () => {
    const { html } = applyCmd(
      selectAll(inlineState("p", "hey")),
      toggleInlineMark(schema.marks.strong)
    )
    expect(html).toBe("<strong>hey</strong>")
  })

  it("applies a link as bare inline HTML", () => {
    const view = fakeView(selectAll(inlineState("p", "go")))
    applyLink(view, { href: "/x", title: null, target: null, rel: null })
    expect(serializeDoc(view.state.doc)).toBe('<a href="/x">go</a>')
  })

  it("merges a text-style span without a wrapping block", () => {
    const view = fakeView(selectAll(inlineState("span", "t")))
    applyTextStyle(view, "color", "red")
    expect(norm(serializeDoc(view.state.doc))).toBe(
      '<span style="color:red">t</span>'
    )
  })

  it("no-ops every block command", () => {
    const state = selectAll(inlineState("p", "x"))
    const noop = { blockFormat: setBlockFormat("h1"), list: toggleList(false) }
    expect(noop.blockFormat(state, undefined)).toBe(false)
    expect(noop.list(state, undefined)).toBe(false)
    expect(setAlign("center")(state, undefined)).toBe(false)
    expect(indent(1)(state, undefined)).toBe(false)
    expect(insertHorizontalRule(state, undefined)).toBe(false)
    expect(blockFormat(state)).toBe("")
    expect(listActive(state, false)).toBe(false)
    expect(alignActive(state, "center")).toBe(false)
  })

  it("removeFormat still strips marks in inline mode", () => {
    const { html } = applyCmd(
      selectAll(inlineState("p", "<strong>x</strong>")),
      removeFormat
    )
    expect(html).toBe("x")
  })

  it("inserts a hard break at the caret", () => {
    // Caret at the end of "ab" (positions: 0 | a=1 | b=2).
    const state = inlineState("p", "ab")
    const at = state.apply(
      state.tr.setSelection(
        TextSelection.create(state.doc, state.doc.content.size)
      )
    )
    const { html } = applyCmd(at, insertHardBreak)
    expect(html).toBe("ab<br>")
  })

  it("round-trips a <br> as bare inline HTML from a leaf host", () => {
    const host = document.createElement("p")
    host.innerHTML = "a<br>b"
    expect(serializeDoc(parseElement(host))).toBe("a<br>b")
  })

  it("carries hard_break in the inline schema", () => {
    expect(inlineSchema.nodes.hard_break).toBeDefined()
  })
})

// A minimal stand-in for EditorView: applyTextStyle / applyLink only touch
// `.focus()`, `.state` and `.dispatch`.
const fakeView = (initial: EditorState) => {
  const view = {
    state: initial,
    focus() {},
    dispatch(tr: import("prosemirror-state").Transaction) {
      view.state = view.state.apply(tr)
    },
  }
  return view as unknown as import("prosemirror-view").EditorView & {
    state: EditorState
  }
}

/** Put a collapsed caret inside the first text of a state. */
const caretIn = (state: EditorState) => {
  const $pos = state.doc.resolve(2)
  return state.apply(state.tr.setSelection(new TextSelection($pos)))
}
