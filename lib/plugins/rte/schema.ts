// The ProseMirror schema the rich-text editor conforms to.
//
// Built from `prosemirror-schema-basic` + `prosemirror-schema-list`, then
// extended for parity with the old execCommand toolbar:
//   - paragraph / heading carry `align` + `indent` block attributes (what
//     `justify*` and `indent`/`outdent` used to write as inline style),
//   - a `textStyle` mark carries color / background / font-size / font-family
//     as inline `style` — the vehicle for theme tokens (`var(--tc--preset--…)`),
//   - underline / strikethrough / subscript / superscript marks,
//   - link gains `target` / `rel`.
//
// Permissiveness note: ProseMirror re-parses a component's HTML through this
// schema on first edit, so anything the parse rules don't recognize is dropped.
// We keep `class` on blocks and on the style span, and read inline color / size
// / family off the raw `style` attribute (not the CSSOM — jsdom and browsers
// disagree on `var()` in typed properties). Deeply non-conforming trees still
// normalize; that matches how the built-in engine already behaved.

import {
  DOMParser as PMDOMParser,
  DOMSerializer,
  Schema,
  type DOMOutputSpec,
  type MarkSpec,
  type Node as PMNode,
  type NodeSpec,
  type TagParseRule,
} from "prosemirror-model"
import { schema as basicSchema, marks as basicMarks } from "prosemirror-schema-basic"
import { addListNodes } from "prosemirror-schema-list"

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

/** One indent step, in `em`. `indent: 2` → `margin-left: 4em`. */
const INDENT_STEP_EM = 2

/** Parse a raw `style` attribute into a lowercased declaration map. */
const styleMap = (dom: HTMLElement): Map<string, string> => {
  const map = new Map<string, string>()
  for (const decl of (dom.getAttribute("style") || "").split(";")) {
    const i = decl.indexOf(":")
    if (i === -1) continue
    const prop = decl.slice(0, i).trim().toLowerCase()
    const value = decl.slice(i + 1).trim()
    if (prop && value) map.set(prop, value)
  }
  return map
}

// --- align / indent, shared by paragraph + heading ------------------------

type BlockAttrs = {
  align: string | null
  indent: number
  id: string | null
  class: string | null
}

const alignIndentAttrs = () => ({
  align: { default: null },
  indent: { default: 0 },
  // `id` / `class` are preserved so GrapesJS component ids (and their styles)
  // survive the edit → serialize → re-parse round-trip instead of being
  // regenerated on every close.
  id: { default: null },
  class: { default: null },
})

const readBlockAttrs = (dom: HTMLElement): BlockAttrs => {
  const style = styleMap(dom)
  const align = style.get("text-align") || dom.getAttribute("align")
  let indent = 0
  const ml = style.get("margin-left")
  const em = ml && /^([\d.]+)em$/.exec(ml)
  if (em) indent = Math.max(0, Math.round(parseFloat(em[1]) / INDENT_STEP_EM))
  return {
    align: align && (ALIGNMENTS as readonly string[]).includes(align) ? align : null,
    indent,
    id: dom.getAttribute("id") || null,
    class: dom.getAttribute("class") || null,
  }
}

const blockDOMAttrs = (node: PMNode): Record<string, string> => {
  const attrs: Record<string, string> = {}
  const styles: string[] = []
  if (node.attrs.align) styles.push(`text-align:${node.attrs.align}`)
  if (node.attrs.indent)
    styles.push(`margin-left:${node.attrs.indent * INDENT_STEP_EM}em`)
  if (styles.length) attrs.style = styles.join(";")
  if (node.attrs.id) attrs.id = node.attrs.id as string
  if (node.attrs.class) attrs.class = node.attrs.class as string
  return attrs
}

const paragraph: NodeSpec = {
  content: "inline*",
  group: "block",
  attrs: alignIndentAttrs(),
  parseDOM: [{ tag: "p", getAttrs: (dom) => readBlockAttrs(dom as HTMLElement) }],
  toDOM: (node) => ["p", blockDOMAttrs(node), 0] as DOMOutputSpec,
}

const heading: NodeSpec = {
  content: "inline*",
  group: "block",
  defining: true,
  attrs: { level: { default: 1 }, ...alignIndentAttrs() },
  parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({
    tag: `h${level}`,
    getAttrs: (dom: HTMLElement) => ({ level, ...readBlockAttrs(dom) }),
  })),
  toDOM: (node) =>
    [`h${node.attrs.level}`, blockDOMAttrs(node), 0] as DOMOutputSpec,
}

// --- id / class passthrough for the nodes we don't hand-author -------------

/** Merge `id` + `class` into a serializer's output attribute object. */
const injectDOMAttrs = (spec: DOMOutputSpec, node: PMNode): DOMOutputSpec => {
  if (!Array.isArray(spec)) return spec
  const extra: Record<string, string> = {}
  if (node.attrs.id) extra.id = node.attrs.id as string
  if (node.attrs.class) extra.class = node.attrs.class as string
  if (!Object.keys(extra).length) return spec
  const [tag, ...rest] = spec
  const hasAttrs =
    rest.length > 0 &&
    rest[0] != null &&
    typeof rest[0] === "object" &&
    !Array.isArray(rest[0])
  return hasAttrs
    ? ([tag, { ...(rest[0] as object), ...extra }, ...rest.slice(1)] as DOMOutputSpec)
    : ([tag, extra, ...rest] as DOMOutputSpec)
}

/**
 * Add an `id` + `class` passthrough to block nodes whose specs come from the
 * base/list schemas (blockquote, lists, …). Without this, ProseMirror drops the
 * GrapesJS component id on serialize and `parseContent` mints a fresh one on
 * every close — orphaning any style keyed to that id.
 */
type NodeMap = ReturnType<typeof addListNodes>

const preserveIdClass = (map: NodeMap, names: string[]): NodeMap => {
  let out = map
  for (const name of names) {
    const base = out.get(name)
    if (!base) continue
    // The nodes we patch here only carry tag rules (no inline-style rules).
    const parseDOM = ((base.parseDOM as TagParseRule[] | undefined) || []).map(
      (rule): TagParseRule => ({
        ...rule,
        getAttrs: (dom: HTMLElement) => {
          const prev = rule.getAttrs ? rule.getAttrs(dom) : (rule.attrs ?? {})
          if (prev === false || prev == null) return prev
          return {
            ...prev,
            id: dom.getAttribute("id") || null,
            class: dom.getAttribute("class") || null,
          }
        },
      })
    )
    const baseToDOM = base.toDOM
    out = out.update(name, {
      ...base,
      attrs: { ...base.attrs, id: { default: null }, class: { default: null } },
      parseDOM,
      toDOM: baseToDOM
        ? (node: PMNode) => injectDOMAttrs(baseToDOM(node), node)
        : baseToDOM,
    })
  }
  return out
}

// --- nodes ----------------------------------------------------------------

// Start from the basic schema's node map (an OrderedMap), patch the two
// textblocks that gained attrs, then mix in the list nodes. `image` is dropped
// — text components don't host inline images in this builder.
const nodes = preserveIdClass(
  addListNodes(
    basicSchema.spec.nodes
      .update("paragraph", paragraph)
      .update("heading", heading)
      .remove("image"),
    "paragraph block*",
    "block"
  ),
  ["blockquote", "code_block", "horizontal_rule", "ordered_list", "bullet_list", "list_item"]
)

// --- marks ----------------------------------------------------------------

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

const subscript: MarkSpec = {
  excludes: "subscript superscript",
  parseDOM: [{ tag: "sub" }, { style: "vertical-align=sub" }],
  toDOM: () => ["sub", 0] as DOMOutputSpec,
}

const superscript: MarkSpec = {
  excludes: "subscript superscript",
  parseDOM: [{ tag: "sup" }, { style: "vertical-align=super" }],
  toDOM: () => ["sup", 0] as DOMOutputSpec,
}

/** Inline style properties carried by the `textStyle` mark, DOM ↔ attr. */
export const TEXT_STYLE_PROPS = {
  color: "color",
  backgroundColor: "background-color",
  fontSize: "font-size",
  fontFamily: "font-family",
} as const

export type TextStyleAttr = keyof typeof TEXT_STYLE_PROPS

const textStyle: MarkSpec = {
  attrs: {
    color: { default: null },
    backgroundColor: { default: null },
    fontSize: { default: null },
    fontFamily: { default: null },
    id: { default: null },
    class: { default: null },
  },
  inclusive: true,
  parseDOM: [
    {
      tag: "span",
      getAttrs: (dom: HTMLElement) => {
        const style = styleMap(dom)
        const attrs = {
          color: style.get("color") || null,
          backgroundColor: style.get("background-color") || null,
          fontSize: style.get("font-size") || null,
          fontFamily: style.get("font-family") || null,
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
  code: basicMarks.code,
  underline,
  strikethrough,
  subscript,
  superscript,
  textStyle,
}

export const schema = new Schema({ nodes, marks })

// --- HTML round-trip ------------------------------------------------------

const domParser = PMDOMParser.fromSchema(schema)
const domSerializer = DOMSerializer.fromSchema(schema)

/** Parse a component's DOM element into a ProseMirror document. */
export const parseElement = (el: HTMLElement): PMNode => domParser.parse(el)

/** Serialize a document to an HTML string (the authoritative RTE output). */
export const serializeDoc = (doc: PMNode): string => {
  const target = document.createElement("div")
  target.appendChild(domSerializer.serializeFragment(doc.content))
  return target.innerHTML
}
