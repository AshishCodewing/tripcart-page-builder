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
import type {
  CustomRendererPropsWithConfig,
  RendererReactOptions,
} from "./types"

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
      ;[...component.views].forEach((v) => v.remove())
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
    ].join(" ")
    const removeEvents = [cmpEvents.removed, "rerender"].join(" ")

    component.on(updateEvents, bumpKey)
    component.on(removeEvents, dropView)

    return () => {
      component.off(updateEvents, bumpKey)
      component.off(removeEvents, dropView)
      dropView()
    }
  }, [component])

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
  const Tag =
    (cfgEntry?.component as React.ElementType | undefined) ||
    tagName ||
    component.tagName ||
    "div"

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
  const merged = [...childNodes, children].filter(
    (n) => n ?? false
  ) as ReactNode[]
  const finalChildren = merged.length ? merged : null

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

  // For text components, force-remount on key bump so RTE state doesn't
  // re-attach to a stale node.
  const reactKey = component.isInstanceOf("text") ? key : undefined
  // connectDom is a callback ref by design: it binds the rendered DOM node
  // back to the GrapesJS view. The lint rule conservatively flags any
  // function-as-ref because it can't tell intentional callback refs apart
  // from accidental ones.
  /* eslint-disable react-hooks/refs */
  return createElement(
    Tag,
    { ...reactProps, ref: connectDom, key: reactKey },
    component.get("void") ? null : finalChildren
  )
  /* eslint-enable react-hooks/refs */
}
