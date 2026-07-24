// Recursive React renderer for a GrapesJS component subtree, plus the hook
// that wires re-render and view binding back into the model. Component types
// registered with a React `component` get wrapped in <gjs-wrapper> so the view
// has a stable selectable root; everything else falls through to the matching
// HTML tag.

"use client"

import { createElement, useEffect, useState, type ReactNode } from "react"
import type { Component, ComponentView, Editor } from "grapesjs"
import { attrsToReactProps } from "./attrs"
import { bindComponentToElement } from "./bind"
import { booleanAttrPresent, selectDefaultValue } from "./form-controls"
import { mergeRenderChildren, resolveComponentTag } from "./render-helpers"
import type {
  CustomRendererPropsWithConfig,
  RendererReactOptions,
} from "./types"

/**
 * A repaint signal that re-mounts a component's React element (fresh render
 * key) WITHOUT the synchronous `dropView`/`view.remove()` that `rerender`
 * triggers. The RTE fires this after ProseMirror tears down an unchanged block
 * so the emptied DOM is restored from the model — using `rerender` here would
 * race `view.remove()` against the just-destroyed ProseMirror DOM
 * (`Node.removeChild: not a child`).
 */
export const RTE_REPAINT_EVENT = "tc:rte-repaint"

interface RenderArgs {
  editor: Editor
  component: Component
  frameView: CustomRendererPropsWithConfig["frameView"]
}

export interface RenderCanvasComponentProps extends RenderArgs {
  config: RendererReactOptions
  tagName?: string
  children?: ReactNode
  onMount?: (view: ComponentView) => void
}

// Subscribe to the GrapesJS event stream for one component: bump a key on
// updates, drop the bound view on remove. `connectDom` is the ref a render
// path passes to its host element to (re)bind the view.
const useCanvasRender = (args: RenderArgs) => {
  const { editor, component, frameView } = args
  const [renderKey, setRenderKey] = useState(0)
  const [view, setView] = useState<ComponentView | undefined>(undefined)

  useEffect(() => {
    if (!component) return

    const bumpKey = () => setRenderKey((k) => k + 1)
    const dropView = () => {
      // Only tear down views belonging to THIS frame; a component can have a
      // live view in another frame/device that must survive.
      ;[...component.views]
        .filter((v) => v.frameView === frameView)
        .forEach((v) => v.remove())
      setView(undefined)
    }

    const cmpEvents = (
      component.em as { Components: { events: Record<string, string> } }
    ).Components.events
    const updateEvents = [
      ...["components", "attributes", "classes"].map(
        (k) => `${cmpEvents.update}:${k}`
      ),
      "rerender",
      // Bump the render key (re-mount) only — no `dropView` (see the event's doc).
      RTE_REPAINT_EVENT,
    ].join(" ")
    const removeEvents = [cmpEvents.removed, "rerender"].join(" ")

    component.on(updateEvents, bumpKey)
    component.on(removeEvents, dropView)

    return () => {
      component.off(updateEvents, bumpKey)
      component.off(removeEvents, dropView)
      dropView()
    }
  }, [component, frameView])

  const connectDom = (el: HTMLElement | null) => {
    if (!el) return
    const bound = bindComponentToElement({ editor, component, el, frameView })
    setView(bound)
  }

  return { key: renderKey, view, connectDom }
}

export function RenderCanvasComponent(
  props: RenderCanvasComponentProps
): ReactNode {
  const { component, config, editor, frameView, onMount, tagName, children } =
    props
  const { key, view, connectDom } = useCanvasRender({
    editor,
    component,
    frameView,
  })

  // Wait one tick so the wrapping ref has been attached before the parent
  // tree is told the root is mounted; postRender is then queued one more
  // tick so the view's children have rendered too.
  useEffect(() => {
    if (!view && !onMount) return
    const t = setTimeout(() => {
      if (view) {
        onMount?.(view)
        setTimeout(() => view.postRender())
      }
    })
    return () => clearTimeout(t)
  }, [view, onMount])

  const cmpType = (component.get("type") as string) || "default"
  const content = (component as { content?: ReactNode }).content
  const cfgEntry = config.components?.[cmpType]
  const Tag = resolveComponentTag(
    cfgEntry?.component as React.ElementType | undefined,
    tagName,
    component.tagName
  )

  const childCmps = component.components()
  const childNodes = childCmps.length
    ? childCmps.map((child: Component) => (
        <RenderCanvasComponent
          key={child.cid}
          component={child}
          config={config}
          editor={editor}
          frameView={frameView}
        />
      ))
    : [content || undefined]

  const reactProps = attrsToReactProps(
    component.getAttributes() as Record<string, unknown>
  )
  const EditorRender = cfgEntry?.editorRender
  const finalChildren = mergeRenderChildren(childNodes, children)

  if (EditorRender) {
    return (
      <EditorRender
        props={reactProps}
        editor={editor}
        component={component}
        connectDom={connectDom}
      >
        {finalChildren}
      </EditorRender>
    )
  }

  if (cfgEntry?.component) {
    return (
      <gjs-wrapper ref={connectDom} style={cfgEntry.wrapperStyle}>
        {createElement(Tag, reactProps, finalChildren)}
      </gjs-wrapper>
    )
  }

  if (component.isInstanceOf("textnode")) {
    return content as ReactNode
  }

  // Force-remount on key bump for every component edited through
  // contenteditable/RTE, so after a `syncContent` the DOM is rebuilt fresh
  // from the model instead of React reconciling in place over nodes the
  // browser's contenteditable rearranged (which duplicates/scrambles text and
  // spawns stray <br>s — worst on a `<a>` link). `isInstanceOf("text")` misses
  // `link` (its `typeExtends` is only `["link"]`, so it isn't a text instance),
  // so key off `editable` too — exactly the set that runs the text-edit
  // lifecycle (default Text, headings, links, rich-text).
  const isEditableText =
    component.isInstanceOf("text") || !!component.get("editable")
  const reactKey = isEditableText ? key : undefined
  // connectDom is a callback ref by design: it binds the rendered DOM node
  // back to the GrapesJS view. The lint rule conservatively flags any
  // function-as-ref because it can't tell intentional callback refs apart
  // from accidental ones.
  /* eslint-disable react-hooks/refs */

  // React treats raw form controls as (un)controlled inputs (children on
  // <textarea> throw, `selected` on <option> warns), while GrapesJS stores
  // the parsed-HTML shape — translate to defaultValue (see ./form-controls).
  const rawTag = typeof Tag === "string" ? Tag.toLowerCase() : ""
  if (rawTag === "textarea") {
    const text =
      childCmps
        .map((c: Component) =>
          c.isInstanceOf("textnode")
            ? String((c as { content?: unknown }).content ?? "")
            : ""
        )
        .join("") || (typeof content === "string" ? content : "")
    return createElement(Tag, {
      ...reactProps,
      ref: connectDom,
      key: reactKey,
      defaultValue: text || undefined,
    })
  }
  if (rawTag === "option") delete reactProps.selected
  if (rawTag === "input" && "checked" in reactProps) {
    reactProps.defaultChecked = booleanAttrPresent(reactProps.checked)
    delete reactProps.checked
  }
  if (
    rawTag === "select" &&
    !("value" in reactProps) &&
    !("defaultValue" in reactProps)
  ) {
    const defaultValue = selectDefaultValue(
      childCmps
        .filter(
          (c: Component) => (c.tagName || "").toLowerCase() === "option"
        )
        .map((c: Component) => {
          const attrs = c.getAttributes() as Record<string, unknown>
          return {
            selected: booleanAttrPresent(attrs.selected),
            value: typeof attrs.value === "string" ? attrs.value : undefined,
            text: c
              .components()
              .map((t: Component) =>
                t.isInstanceOf("textnode")
                  ? String((t as { content?: unknown }).content ?? "")
                  : ""
              )
              .join(""),
          }
        }),
      booleanAttrPresent(reactProps.multiple)
    )
    if (defaultValue !== undefined) reactProps.defaultValue = defaultValue
  }

  return createElement(
    Tag,
    { ...reactProps, ref: connectDom, key: reactKey },
    component.get("void") ? null : finalChildren
  )
  /* eslint-enable react-hooks/refs */
}
