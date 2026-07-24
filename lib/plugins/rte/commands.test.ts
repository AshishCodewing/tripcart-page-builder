// @vitest-environment jsdom

import { EditorState, TextSelection } from "prosemirror-state"
import { describe, expect, it } from "vitest"

import {
  alignActive,
  applyLink,
  applyTextStyle,
  blockFormat,
  indent,
  insertImage,
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
import { parseElement, schema, serializeDoc } from "./schema"

const el = (html: string) => {
  const div = document.createElement("div")
  div.innerHTML = html
  return div
}

/** Build a state from an HTML fragment, selecting `from`..`to` if given. */
const stateFrom = (html: string, from?: number, to?: number) => {
  let state = EditorState.create({ doc: parseElement(el(html)), schema })
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

/** Collapse inline-style whitespace for stable comparisons. */
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

  it("preserves text-align on a block (via the style bag)", () => {
    const html = '<p style="text-align:center">mid</p>'
    expect(norm(serializeDoc(parseElement(el(html))))).toContain(
      "text-align:center"
    )
  })

  it("preserves ids, classes and arbitrary data-* attributes (attrs bag)", () => {
    const html =
      '<h2 id="i1" class="hero" data-x="1">Title</h2>' +
      '<p id="i2">para with <a href="/x" id="i3">link</a></p>' +
      '<blockquote id="i4"><p id="i5">quote</p></blockquote>' +
      '<ul id="i6"><li id="i7"><p id="i8">item</p></li></ul>'
    const out = serializeDoc(parseElement(el(html)))
    for (const id of ["i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8"]) {
      expect(out).toContain(`id="${id}"`)
    }
    expect(out).toContain('class="hero"')
    expect(out).toContain('data-x="1"')
  })

  it("drops GrapesJS' draggable chrome but keeps real attributes", () => {
    const html = '<p draggable="true" id="keep" data-gjs-type="text">t</p>'
    const out = serializeDoc(parseElement(el(html)))
    expect(out).not.toContain("draggable")
    expect(out).toContain('id="keep"')
    expect(out).toContain('data-gjs-type="text"')
  })

  it("keeps an unknown block element via nonTextNode", () => {
    const html = '<section class="x"><p>inner</p></section>'
    const out = serializeDoc(parseElement(el(html)))
    expect(out).toContain("<section")
    expect(out).toContain('class="x"')
    expect(out).toContain("inner")
  })
})

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
})

describe("block format", () => {
  it("reads and sets the block format", () => {
    const state = stateFrom("<p>hi</p>", 2)
    expect(blockFormat(state)).toBe("p")
    const { html } = applyCmd(state, setBlockFormat("h3"))
    expect(html).toBe("<h3>hi</h3>")
    expect(blockFormat(stateFrom("<h3>hi</h3>", 2))).toBe("h3")
  })

  it("carries the attribute bag across a format change", () => {
    const { html } = applyCmd(
      stateFrom('<p id="keep" class="c">hi</p>', 2),
      setBlockFormat("h2")
    )
    expect(html).toContain("<h2")
    expect(html).toContain('id="keep"')
    expect(html).toContain('class="c"')
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

describe("alignment and indent (style bag)", () => {
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

  it("outdents back to no indent", () => {
    const { html } = applyCmd(
      stateFrom('<p style="margin-left:2em">x</p>', 2),
      indent(-1)
    )
    expect(html).toBe("<p>x</p>")
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

describe("image", () => {
  it("round-trips an <img> (attrs bag)", () => {
    const html = '<p>a</p><p><img src="/x.png" alt="alt"></p>'
    const out = serializeDoc(parseElement(el(html)))
    expect(out).toContain("<img")
    expect(out).toContain('src="/x.png"')
    expect(out).toContain('alt="alt"')
  })

  it("inserts an image node at the caret", () => {
    const { html } = applyCmd(
      stateFrom("<p>hi</p>", 2),
      insertImage({ src: "/x.png", alt: "a" })
    )
    expect(html).toContain("<img")
    expect(html).toContain('src="/x.png"')
  })
})

describe("textStyle merge", () => {
  it("merges colour after size onto one span", () => {
    const view = fakeView(selectFirstBlock(stateFrom("<p>t</p>")))
    applyTextStyle(view, "fontSize", "var(--tc--preset--font-size--lg)")
    view.state = selectFirstBlock(view.state)
    applyTextStyle(view, "color", "red")
    const html = serializeDoc(view.state.doc)
    expect(norm(html)).toBe(
      '<p><span style="color:red;font-size:var(--tc--preset--font-size--lg)">t</span></p>'
    )
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
