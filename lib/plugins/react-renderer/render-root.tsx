// Top-level mount: replace the iframe's body content with a React tree.
// GrapesJS hands us the iframe's window/document and the root frame; we run
// createRoot against the body and render the project starting from the
// frame's root component, then unmount on either frame teardown or window
// unload (whichever fires first).

"use client"

import { Fragment } from "react"
import { createRoot } from "react-dom/client"
import type { ComponentView } from "grapesjs"
import { RenderCanvasComponent } from "./render-component"
import type { CustomRendererPropsWithConfig } from "./types"

const RenderRootInner = (
  props: CustomRendererPropsWithConfig & {
    component: import("grapesjs").Component
    onMount: (view: ComponentView) => void
  }
) => {
  const { editor, component, window: win, frameView, config, onMount } = props
  const doc = win.document

  const RootComponent = config.rootComponent || Fragment
  const editorProps = config.rootComponent
    ? { editorProps: { doc, editor, frameView } }
    : {}

  const BodyAfter = config.bodyAfter || Fragment

  return (
    <RootComponent {...editorProps}>
      <RenderCanvasComponent
        tagName="div"
        component={component}
        config={config}
        editor={editor}
        frameView={frameView}
        onMount={onMount}
      >
        <BodyAfter {...editorProps} />
      </RenderCanvasComponent>
    </RootComponent>
  )
}

export const renderRoot = (
  props: CustomRendererPropsWithConfig
): ComponentView | undefined => {
  const { frame, window: win, onMount, editor } = props
  const canvasEvents = editor.Canvas.events
  const { root } = frame

  try {
    const reactRoot = createRoot(win.document.body)
    reactRoot.render(
      <RenderRootInner {...props} component={root} onMount={onMount} />
    )
    // React 19 forbids synchronous unmount during render. The frameUnload
    // event can fire while React is committing — queue the unmount on a
    // microtask so it runs after the current render finishes.
    let unmounted = false
    const cleanup = () => {
      if (unmounted) return
      unmounted = true
      queueMicrotask(() => reactRoot.unmount())
    }
    frame.once(canvasEvents.frameUnload, cleanup)
    win.addEventListener("unload", cleanup)
  } catch (err) {
    console.warn(err)
  }

  return root.getView()
}
