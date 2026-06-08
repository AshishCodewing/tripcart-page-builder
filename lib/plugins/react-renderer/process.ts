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

const isString = (v: unknown): v is string => typeof v === "string"

const textNode = (content: string) => ({ type: "textnode", content })

export const processReactElements = (
  args: ProcessCtx & { model: unknown }
): Record<string, unknown> | undefined => {
  const { model, editor, config } = args
  if (!isReactElement(model)) return undefined

  const { type, props = {} } = model as {
    type: unknown
    props: Record<string, unknown>
  }
  const { children, className, style, ...rest } = props

  const out: Record<string, unknown> = {}
  const isSymbolType = typeof type === "symbol"

  if (typeof type === "function") {
    // Function component → resolve via config.components map.
    const match = getComponentConfig(
      config,
      type as Parameters<typeof getComponentConfig>[1]
    )
    out.type = match?.type
  } else if (typeof type === "string" && editor.Components.getType(type)) {
    out.type = type
  } else if (typeof type === "string" && !isSymbolType) {
    out.tagName = type
  }
  // Symbols (Fragment, etc.) leave both type and tagName unset; the renderer
  // will treat the element as a transparent container.

  if (className) out.classes = className
  if (style && typeof style === "object") {
    out.style = camelKeysToKebabStyle(style as Record<string, string | number>)
  }

  // JSX surfaces `children` as one of: undefined, a string, a single element,
  // or an array of elements/strings. Coerce non-empty values to an array so
  // single-child trees aren't silently dropped.
  if (children !== undefined && children !== null) {
    const childArray = Array.isArray(children) ? children : [children]
    const components = childArray
      .map((child) =>
        isString(child)
          ? textNode(child)
          : isReactElement(child)
            ? processReactElements({ ...args, model: child })
            : null
      )
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
    if (components.length) out.components = components
  }

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
// inspecting the block still see what was authored.
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

// Same idea, for pages added with a JSX `component`.
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
