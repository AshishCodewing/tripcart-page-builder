// Convert a React element (passed as block content, page content, or fed
// through Components.config.processor) into a GrapesJS component definition.
// Non-React inputs return undefined so GrapesJS keeps the original definition.

import type { Block, Editor, PageProperties } from "grapesjs"
import { camelKeysToKebabStyle } from "./style"
import { getComponentConfig, isReactElement } from "./react-element"
import type { RendererReactOptions } from "./types"

interface ProcessCtx {
  editor: Editor
  config: RendererReactOptions
}

// A processed GrapesJS component definition. A real React element always
// produces an object; only a non-React model yields `undefined`. A symbol-typed
// element (Fragment) is transparent and produces an array of its flattened
// children instead.
type ProcessedDefinition = Record<string, unknown>

const isString = (v: unknown): v is string => typeof v === "string"

const textNode = (content: string) => ({ type: "textnode", content })

// Process JSX children into a flat definition list. JSX surfaces `children` as
// one of: undefined, a string, a single element, or an array of
// elements/strings. Fragment children (which process to an array) are spliced
// into the parent's `components` via flatMap; non-element/non-string children
// are dropped, as before.
const processChildren = (
  args: ProcessCtx,
  children: unknown
): ProcessedDefinition[] => {
  if (children === undefined || children === null) return []
  const childArray = Array.isArray(children) ? children : [children]
  return childArray.flatMap((child): ProcessedDefinition[] => {
    if (isString(child)) return [textNode(child)]
    if (!isReactElement(child)) return []
    const processed = processReactElements({ ...args, model: child })
    if (processed === undefined) return []
    return Array.isArray(processed) ? processed : [processed]
  })
}

export const processReactElements = (
  args: ProcessCtx & { model: unknown }
): ProcessedDefinition | ProcessedDefinition[] | undefined => {
  const { model, editor, config } = args
  if (!isReactElement(model)) return undefined

  const { type, props = {} } = model as {
    type: unknown
    props: Record<string, unknown>
  }
  const { children, className, style, ...rest } = props

  // Symbols (Fragment, etc.) are transparent: splice their flattened children
  // into the parent instead of materializing a container. An empty Fragment
  // yields [], so it contributes nothing.
  if (typeof type === "symbol") {
    return processChildren(args, children)
  }

  const out: ProcessedDefinition = {}

  if (typeof type === "function") {
    // Function component → resolve via config.components map.
    const match = getComponentConfig(
      config,
      type as Parameters<typeof getComponentConfig>[1]
    )
    if (match) {
      out.type = match.type
    } else {
      // Unregistered: degrade loudly but keep a usable definition. We omit the
      // `type` key entirely (never `type: undefined`) so GrapesJS doesn't
      // re-process the raw element through its $$typeof preset branch.
      const named = type as { displayName?: string; name?: string }
      const label = named.displayName || named.name || "anonymous"
      console.warn(
        `[react-renderer] unregistered React component <${label}>; ` +
          `add it to config.components to render it. Falling back to a default container.`
      )
    }
  } else if (typeof type === "string" && editor.Components.getType(type)) {
    out.type = type
  } else if (typeof type === "string") {
    out.tagName = type
  }

  if (className) out.classes = className
  if (style && typeof style === "object") {
    out.style = camelKeysToKebabStyle(style as Record<string, string | number>)
  }

  const components = processChildren(args, children)
  if (components.length) out.components = components

  if (Object.keys(rest).length) {
    // splitPropsFromAttr separates HTML attributes (rendered on the tag) from
    // model-level props (set on the Component). Both are needed for the
    // round-trip through GrapesJS.
    const split = editor.Parser.parserHtml.splitPropsFromAttr(rest) as {
      attrs: Record<string, unknown>
      props: Record<string, unknown>
    }
    out.attributes = split.attrs
    Object.assign(out, split.props)
  }

  return out
}

// Block content can be JSX. When a block is registered, swap the React tree
// for a processed component definition so dropping the block produces real
// GrapesJS components — but stash the original on `reactContent` so callers
// inspecting the block still see what was authored. A processed Fragment yields
// an array, which `content` natively accepts.
export const manageReactBlockContent =
  (ctx: ProcessCtx) =>
  (block: Block): void => {
    const content = block.getContent()
    if (isReactElement(content)) {
      block.set({
        content: processReactElements({ ...ctx, model: content }),
        reactContent: content,
      })
    }
  }

// Same idea, for pages added with a JSX `component`. A processed Fragment
// yields an array, which `components` natively accepts.
export const manageReactPageContent =
  (ctx: ProcessCtx) =>
  (pageProps: PageProperties): void => {
    const cmp = (pageProps as { component?: unknown }).component
    if (isReactElement(cmp)) {
      ;(pageProps as { component?: unknown }).component = {
        components: processReactElements({ ...ctx, model: cmp }),
      }
    }
  }
