import { useEditorMaybe } from "@grapesjs/react"
import { createPortal } from "react-dom"
import { useEffect, useRef } from "react"
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useTransitionStyles,
  type Placement,
} from "@floating-ui/react"
import type { Component } from "grapesjs"

type Props = {
  /** Component to anchor to. Pass `null` to unmount the floating element. */
  target: Component | null
  placement?: Placement
  fallbacks?: Placement[]
  /**
   * Inline `pointer-events` for the wrapper. `auto` for interactive content
   * (toolbar buttons); `none` for pure labels that should let cursor events
   * pass through to the canvas (hover badge).
   */
  pointerEvents?: React.CSSProperties["pointerEvents"]
  children: React.ReactNode
}

const DEFAULT_FALLBACKS: Placement[] = [
  "bottom-start",
  "top-start",
  "bottom-end",
  "left",
]

// Shared floating-ui + portal wrapper used by FloatingToolbar (anchored to the
// selected component) and FloatingBadge (anchored to the hovered component).
// Maps the target component's iframe-local rect into screen coordinates via a
// virtual reference and tracks canvas scroll / update events so the floating
// element stays glued to the component.
export function CanvasFloating({
  target,
  placement = "top-end",
  fallbacks = DEFAULT_FALLBACKS,
  pointerEvents = "auto",
  children,
}: Props) {
  const editor = useEditorMaybe()

  const virtualRef = useRef({
    getBoundingClientRect: () => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      toJSON() {
        return this
      },
    }),
  })

  const { refs, floatingStyles, context } = useFloating({
    open: !!target,
    placement,
    middleware: [
      offset(8),
      flip({ fallbackPlacements: fallbacks }),
      shift({ padding: 8, mainAxis: true, crossAxis: true }),
    ],
    whileElementsMounted: autoUpdate,
  })
  const { setFloating, setPositionReference } = refs
  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: 150,
  })

  useEffect(() => {
    if (!editor) return

    const updateRect = () => {
      const el = target?.getEl()
      const frame = editor.Canvas.getFrameEl?.()
      if (!el || !frame) return
      virtualRef.current.getBoundingClientRect = () => {
        const elRect = el.getBoundingClientRect()
        const frameRect = frame.getBoundingClientRect()
        return new DOMRect(
          elRect.x + frameRect.x,
          elRect.y + frameRect.y,
          elRect.width,
          elRect.height
        )
      }
      setPositionReference(virtualRef.current)
    }

    requestAnimationFrame(updateRect)
    const onUpdate = () => updateRect()
    editor.on("component:update canvas:update", onUpdate)
    const frameEl = editor.Canvas.getFrameEl?.()
    frameEl?.contentWindow?.addEventListener("scroll", onUpdate, true)

    return () => {
      editor.off("component:update canvas:update", onUpdate)
      frameEl?.contentWindow?.removeEventListener("scroll", onUpdate, true)
    }
  }, [editor, target, setPositionReference])

  if (!editor || !isMounted || !target) return null
  const spotsEl = editor.Canvas.getSpotsEl()
  if (!spotsEl) return null

  return createPortal(
    <div
      ref={setFloating}
      style={{ ...floatingStyles, ...transitionStyles, pointerEvents }}
    >
      {children}
    </div>,
    spotsEl
  )
}
