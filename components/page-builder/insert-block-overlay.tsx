"use client"

import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react"
import { useEditorMaybe } from "@grapesjs/react"
import type { Component } from "grapesjs"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { InsertBlockPicker } from "./insert-block-picker"

// Custom canvas spot type for the block-insert button. Registering a spot (vs.
// hand-tracking the rect) lets GrapesJS recompute its coordinates on scroll /
// zoom / component updates and emit `canvas:spot` so we can reposition.
const SPOT_TYPE = "tc-insert-block"

export function InsertBlockOverlay() {
  const editor = useEditorMaybe()
  const [selected, setSelected] = useState<Component | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  // Geometry of the selected component, taken from the spot. Drives an
  // invisible reference box that floating-ui anchors the button to.
  const [boxStyle, setBoxStyle] = useState<React.CSSProperties | null>(null)

  // floating-ui anchors the "+" to the reference box with `flip`/`shift`, so a
  // full-width or edge component can't push the button outside the canvas — it
  // flips above / shifts inward to stay visible. `animationFrame` keeps it
  // glued while the box moves on zoom/scroll (which don't fire the resize /
  // scroll events floating-ui's default autoUpdate listens for).
  const { refs, floatingStyles } = useFloating({
    open: true,
    placement: "bottom-end",
    // Fallback to the opposite *start* corner (top-start), never top-end —
    // that's where FloatingToolbar lives, so the two keep disjoint placement
    // sets and can never overlap.
    middleware: [
      offset(4),
      flip({ fallbackPlacements: ["top-start", "right-end"] }),
      shift({ padding: 8, crossAxis: true }),
    ],
    whileElementsMounted: (reference, floatingEl, update) =>
      autoUpdate(reference, floatingEl, update, { animationFrame: true }),
  })
  const { setReference, setFloating } = refs

  // Track the single selected component (mirrors floating-toolbar gating).
  useEffect(() => {
    if (!editor) return

    const syncSelection = () => {
      const all = editor.getSelectedAll()
      setSelected(all.length === 1 ? all[0] : null)
    }
    const onRemove = (cmp: Component) =>
      setSelected((current) => (current === cmp ? null : current))
    const onDragStart = () => setIsDragging(true)
    const onDragEnd = () => setIsDragging(false)

    editor.on("component:selected", syncSelection)
    editor.on("component:deselected", syncSelection)
    editor.on("component:remove", onRemove)
    editor.on("component:drag:start", onDragStart)
    editor.on("component:drag:end", onDragEnd)

    return () => {
      editor.off("component:selected", syncSelection)
      editor.off("component:deselected", syncSelection)
      editor.off("component:remove", onRemove)
      editor.off("component:drag:start", onDragStart)
      editor.off("component:drag:end", onDragEnd)
    }
  }, [editor])

  // Register the custom spot for the selected component and keep the reference
  // box's geometry in sync via the `canvas:spot` event + the spot's getStyle().
  useEffect(() => {
    if (!editor || !selected || isDragging) return
    const { Canvas } = editor

    const sync = () => {
      const spot = Canvas.getSpots({ type: SPOT_TYPE })[0]
      setBoxStyle(spot ? (spot.getStyle() as React.CSSProperties) : null)
    }

    editor.on("canvas:spot", sync)
    Canvas.addSpot({ type: SPOT_TYPE, component: selected })
    const raf = requestAnimationFrame(sync)

    return () => {
      cancelAnimationFrame(raf)
      editor.off("canvas:spot", sync)
      Canvas.removeSpots({ type: SPOT_TYPE })
    }
  }, [editor, selected, isDragging])

  if (!editor || !selected || isDragging || !boxStyle) return null
  const spotsEl = editor.Canvas.getSpotsEl()
  if (!spotsEl) return null

  return createPortal(
    <>
      {/* Invisible box matching the selected component (positioned by the
          spot); floating-ui uses it as the anchor for the button. */}
      <div
        ref={setReference}
        className="pointer-events-none absolute"
        style={boxStyle}
      />
      <div
        ref={setFloating}
        className="pointer-events-none z-30"
        style={floatingStyles}
      >
        {/* Key by component id so the picker remounts (closing any open
            popover) when the selection changes to another component. */}
        <InsertBlockPicker
          key={selected.getId()}
          editor={editor}
          selected={selected}
        />
      </div>
    </>,
    spotsEl
  )
}
