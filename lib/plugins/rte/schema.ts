// The ProseMirror schema the rich-text editor conforms to.
//
// Structure follows GrapesJS Studio's `rteProseMirror`:
//   - a SINGLE block schema (`doc: "block+"`) — the RTE only ever mounts on the
//     Rich Text block's `<div>` container, so there's no separate inline schema.
//   - every authored node carries a generic `attrs` *bag* that captures ALL of
//     the element's DOM attributes on parse and re-emits them on serialize
//     (`readAttrs`/`bagToDom`). This preserves id / class / data-* / style
//     faithfully across the edit → serialize → re-parse round-trip, replacing
//     the old hand-rolled id/class passthrough. GrapesJS' own `draggable`
//     (canvas chrome) is stripped; `data-gjs-type` is kept so GrapesJS can
//     re-type the child components when it re-parses the content.
//   - a low-priority `nonTextNode` catch-all keeps unknown block elements.
//   - alignment / indent live in each node's preserved `style` (no bespoke
//     typed attrs), the same as Studio.
//
// Marks match Studio's set: strong / em / underline / strikethrough / link plus
// our `textStyle` mark, which keeps colour / background / font-size as inline
// `style` (the vehicle for theme tokens, `var(--tc--preset--…)`). Subscript,
// superscript, inline code and font-family are intentionally dropped.
//
// Permissiveness note: ProseMirror re-parses the element's HTML through this
// schema on each edit. Inline colour / size are read off the raw `style`
// attribute (not the CSSOM — jsdom and browsers disagree on `var()` in typed
// properties).

import {
  DOMParser as PMDOMParser,
  DOMSerializer,
  Schema,
  type DOMOutputSpec,
  type MarkSpec,
  type Node as PMNode,
  type NodeSpec,
} from "prosemirror-model"
import { marks as basicMarks } from "prosemirror-schema-basic"

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

/** Text-alignment values `text-align` may hold. */
export const ALIGNMENTS = ["left", "center", "right", "justify"] as const

/** One indent step, in `em`. `indent` of 1 → `margin-left: 2em`. */
export const INDENT_STEP_EM = 2

// --- generic attribute bag -------------------------------------------------

/** The attrs-bag attribute every authored node carries. */
type AttrBag = Record<string, string>

// A single shared default object; commands must never mutate a node's bag in
// place — they always write a fresh object via `setNodeMarkup`.
const bagSpec = () => ({ attrs: { default: {} as AttrBag } })

/**
 * Read every attribute off an element into a plain record (the "attrs bag").
 * GrapesJS' `draggable` / `contenteditable` are canvas-only chrome and are
 * dropped so they never persist into the saved content.
 */
const readAttrs = (dom: HTMLElement): AttrBag => {
  const out: AttrBag = {}
  for (const attr of Array.from(dom.attributes)) out[attr.name] = attr.value
  delete out.draggable
  delete out.contenteditable
  return out
}

const bagAttrs = (dom: HTMLElement) => ({ attrs: readAttrs(dom) })
const bagToDom = (node: PMNode): AttrBag => (node.attrs.attrs as AttrBag) ?? {}

// --- style helpers (alignment / indent live in the bag's `style`) ----------

/** Parse a `style` string into a lowercased declaration map. */
export const styleToObject = (style: string | undefined): Record<string, string> => {
  const map: Record<string, string> = {}
  for (const decl of (style || "").split(";")) {
    const i = decl.indexOf(":")
    if (i === -1) continue
    const prop = decl.slice(0, i).trim().toLowerCase()
    const value = decl.slice(i + 1).trim()
    if (prop && value) map[prop] = value
  }
  return map
}

/** Serialize a declaration map back to a `style` string (`""` when empty). */
export const objectToStyle = (obj: Record<string, string>): string =>
  Object.entries(obj)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")

// --- nodes -----------------------------------------------------------------

const paragraph: NodeSpec = {
  group: "block",
  content: "inline*",
  attrs: bagSpec(),
  parseDOM: [{ tag: "p", getAttrs: (dom) => bagAttrs(dom as HTMLElement) }],
  toDOM: (node) => ["p", bagToDom(node), 0] as DOMOutputSpec,
}

const heading: NodeSpec = {
  group: "block",
  content: "inline*",
  defining: true,
  attrs: { level: { default: 1 }, ...bagSpec() },
  parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({
    tag: `h${level}`,
    getAttrs: (dom: HTMLElement) => ({ level, attrs: readAttrs(dom) }),
  })),
  toDOM: (node) =>
    [`h${node.attrs.level}`, bagToDom(node), 0] as DOMOutputSpec,
}

const blockquote: NodeSpec = {
  group: "block",
  content: "block+",
  defining: true,
  attrs: bagSpec(),
  parseDOM: [{ tag: "blockquote", getAttrs: (dom) => bagAttrs(dom as HTMLElement) }],
  toDOM: (node) => ["blockquote", bagToDom(node), 0] as DOMOutputSpec,
}

const codeBlock: NodeSpec = {
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,
  attrs: bagSpec(),
  parseDOM: [
    {
      tag: "pre",
      preserveWhitespace: "full",
      getAttrs: (dom) => bagAttrs(dom as HTMLElement),
    },
  ],
  toDOM: (node) => ["pre", bagToDom(node), ["code", 0]] as DOMOutputSpec,
}

const orderedList: NodeSpec = {
  group: "block",
  content: "list_item+",
  attrs: bagSpec(),
  parseDOM: [{ tag: "ol", getAttrs: (dom) => bagAttrs(dom as HTMLElement) }],
  toDOM: (node) => ["ol", bagToDom(node), 0] as DOMOutputSpec,
}

const bulletList: NodeSpec = {
  group: "block",
  content: "list_item+",
  attrs: bagSpec(),
  parseDOM: [{ tag: "ul", getAttrs: (dom) => bagAttrs(dom as HTMLElement) }],
  toDOM: (node) => ["ul", bagToDom(node), 0] as DOMOutputSpec,
}

const listItem: NodeSpec = {
  content: "paragraph block*",
  defining: true,
  attrs: bagSpec(),
  parseDOM: [{ tag: "li", getAttrs: (dom) => bagAttrs(dom as HTMLElement) }],
  toDOM: (node) => ["li", bagToDom(node), 0] as DOMOutputSpec,
}

const horizontalRule: NodeSpec = {
  group: "block",
  attrs: bagSpec(),
  parseDOM: [{ tag: "hr", getAttrs: (dom) => bagAttrs(dom as HTMLElement) }],
  toDOM: (node) => ["hr", bagToDom(node)] as DOMOutputSpec,
}

// Inline image. `src`/`alt`/`title` live in the generic bag (Studio parity), so
// insertion creates `image.create({ attrs: { src } })`.
const image: NodeSpec = {
  inline: true,
  group: "inline",
  draggable: true,
  selectable: true,
  attrs: bagSpec(),
  parseDOM: [{ tag: "img[src]", getAttrs: (dom) => bagAttrs(dom as HTMLElement) }],
  toDOM: (node) => ["img", bagToDom(node)] as DOMOutputSpec,
}

const hardBreak: NodeSpec = {
  inline: true,
  group: "inline",
  selectable: false,
  parseDOM: [{ tag: "br" }],
  toDOM: () => ["br"] as DOMOutputSpec,
}

// Low-priority catch-all so unknown block elements survive the round-trip.
const nonTextNode: NodeSpec = {
  group: "block",
  content: "block*",
  attrs: { tagName: { default: "span" }, ...bagSpec() },
  parseDOM: [
    {
      // `tbody` is skipped so list/table parse rules keep priority.
      tag: "*:not(tbody)",
      getAttrs: (dom: HTMLElement) => ({
        tagName: dom.tagName.toLowerCase(),
        attrs: readAttrs(dom),
      }),
      priority: 0,
    },
  ],
  toDOM: (node) =>
    [node.attrs.tagName as string, bagToDom(node), 0] as DOMOutputSpec,
}

const nodes = {
  doc: { content: "block+" },
  paragraph,
  heading,
  blockquote,
  code_block: codeBlock,
  ordered_list: orderedList,
  bullet_list: bulletList,
  list_item: listItem,
  horizontal_rule: horizontalRule,
  image,
  text: { group: "inline" } as NodeSpec,
  hard_break: hardBreak,
  nonTextNode,
}

// --- marks -----------------------------------------------------------------

const link: MarkSpec = {
  attrs: {
    href: { default: null },
    title: { default: null },
    target: { default: null },
    rel: { default: null },
    id: { default: null },
  },
  inclusive: false,
  parseDOM: [
    {
      tag: "a[href]",
      getAttrs: (dom: HTMLElement) => ({
        href: dom.getAttribute("href"),
        title: dom.getAttribute("title"),
        target: dom.getAttribute("target"),
        rel: dom.getAttribute("rel"),
        id: dom.getAttribute("id"),
      }),
    },
  ],
  toDOM: (mark) => {
    const { href, title, target, rel, id } = mark.attrs
    const attrs: Record<string, string> = {}
    if (href) attrs.href = href
    if (title) attrs.title = title
    if (target) attrs.target = target
    if (rel) attrs.rel = rel
    if (id) attrs.id = id
    return ["a", attrs, 0] as DOMOutputSpec
  },
}

const underline: MarkSpec = {
  parseDOM: [
    { tag: "u" },
    { style: "text-decoration=underline" },
    { style: "text-decoration-line=underline" },
  ],
  toDOM: () => ["u", 0] as DOMOutputSpec,
}

const strikethrough: MarkSpec = {
  parseDOM: [
    { tag: "s" },
    { tag: "strike" },
    { tag: "del" },
    { style: "text-decoration=line-through" },
    { style: "text-decoration-line=line-through" },
  ],
  toDOM: () => ["s", 0] as DOMOutputSpec,
}

/** Inline style properties carried by the `textStyle` mark, DOM ↔ attr. */
export const TEXT_STYLE_PROPS = {
  color: "color",
  backgroundColor: "background-color",
  fontSize: "font-size",
} as const

export type TextStyleAttr = keyof typeof TEXT_STYLE_PROPS

const textStyle: MarkSpec = {
  attrs: {
    color: { default: null },
    backgroundColor: { default: null },
    fontSize: { default: null },
    id: { default: null },
    class: { default: null },
  },
  inclusive: true,
  parseDOM: [
    {
      tag: "span",
      getAttrs: (dom: HTMLElement) => {
        const style = styleToObject(dom.getAttribute("style") || "")
        const attrs = {
          color: style["color"] || null,
          backgroundColor: style["background-color"] || null,
          fontSize: style["font-size"] || null,
          id: dom.getAttribute("id") || null,
          class: dom.getAttribute("class") || null,
        }
        // A bare <span> with nothing we track isn't a style mark — let it fall
        // through so its text is kept but the wrapper is dropped.
        return Object.values(attrs).some(Boolean) ? attrs : false
      },
    },
  ],
  toDOM: (mark) => {
    const styles: string[] = []
    for (const [attr, prop] of Object.entries(TEXT_STYLE_PROPS)) {
      const value = mark.attrs[attr]
      if (value) styles.push(`${prop}:${value}`)
    }
    const attrs: Record<string, string> = {}
    if (styles.length) attrs.style = styles.join(";")
    if (mark.attrs.id) attrs.id = mark.attrs.id as string
    if (mark.attrs.class) attrs.class = mark.attrs.class as string
    return ["span", attrs, 0] as DOMOutputSpec
  },
}

const marks = {
  link,
  em: basicMarks.em,
  strong: basicMarks.strong,
  underline,
  strikethrough,
  textStyle,
}

// --- schemas ---------------------------------------------------------------

/** The block schema the Rich Text block conforms to (`doc: "block+"`). */
export const schema = new Schema({ nodes, marks })

/**
 * The inline schema for leaf elements (links / headings / buttons / the plain
 * Text block). The document holds inline content directly — no paragraph,
 * heading, list or block wrappers — so editing a leaf never introduces block
 * structure. Only `hard_break` (`<br>`, bound to Enter in prosemirror-rte.ts)
 * and the shared inline marks are available; the toolbar hides every
 * block-level control in this mode.
 */
export const inlineSchema = new Schema({
  nodes: {
    doc: { content: "inline*" },
    text: nodes.text,
    hard_break: hardBreak,
  },
  marks,
})

// --- HTML round-trip -------------------------------------------------------

const parser = PMDOMParser.fromSchema(schema)
const serializer = DOMSerializer.fromSchema(schema)
const inlineParser = PMDOMParser.fromSchema(inlineSchema)
const inlineSerializer = DOMSerializer.fromSchema(inlineSchema)

const serializeWith = (ser: DOMSerializer, doc: PMNode): string => {
  const target = document.createElement("div")
  target.appendChild(ser.serializeFragment(doc.content))
  return target.innerHTML
}

/** Parse a component's DOM element into a block ProseMirror document. */
export const parseElement = (el: HTMLElement): PMNode => parser.parse(el)

/** Serialize a block document to an HTML string (the authoritative output). */
export const serializeDoc = (doc: PMNode): string =>
  serializeWith(serializer, doc)

/** Parse a leaf element's inner content into an inline ProseMirror document. */
export const parseInlineElement = (el: HTMLElement): PMNode =>
  inlineParser.parse(el)

/** Serialize an inline document to an HTML string (inline markup, no wrapper). */
export const serializeInlineDoc = (doc: PMNode): string =>
  serializeWith(inlineSerializer, doc)
