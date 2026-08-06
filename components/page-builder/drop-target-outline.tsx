import { useEditorMaybe } from "@grapesjs/react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import type { CanvasSpot, ComponentDragEventData } from "grapesjs"

// Outlines the component a drag will actually land in — the replacement for
// GrapesJS' amber drag highlight, which was the hover highlighter recolored by
// `move-comp` (`gjs-highlighter-warning`) and so went out with the built-in
// hover spot.
//
// Two differences from what it replaces. It tracks the *resolved drop parent*
// from `component:drag`, not the element under the cursor — those diverge
// whenever the cursor is over something that can't accept the drag and the
// sorter walks up to an ancestor. And it's a real canvas spot, so GrapesJS
// keeps its coordinates correct through zoom, canvas scroll and component
// updates (`canvas:spot` fires on all of them) instead of us re-deriving rects.
//
// This is the documented "Spots customization" pattern: attach a spot to a
// component, render it inside `Canvas.getSpotsEl()`, position with
// `spot.getStyle()`. The spots container is `pointer-events: none`, which is
// what an outline wants — nothing here re-enables it.
const DROP_TARGET_SPOT = "tc-drop-target"

export function DropTargetOutline() {
  const editor = useEditorMaybe()
  const [spots, setSpots] = useState<CanvasSpot[]>([])

  // Register the spot against the drop parent, reusing one id so each pointer
  // move updates the existing spot rather than piling up new ones.
  useEffect(() => {
    if (!editor) return
    const { Canvas } = editor

    const clear = () => Canvas.removeSpots({ type: DROP_TARGET_SPOT })
    const onDrag = (data: ComponentDragEventData) => {
      const parent = data.parent
      // No parent means nothing under the cursor accepts the drag; there's
      // nothing to outline, and <DragBadge /> says so.
      //
      // The wrapper is skipped too: it's the page itself, so outlining it
      // rings the whole canvas and tints every component — which is most
      // drops on a flat page. The insertion placeholder already shows where
      // the component lands there. The outline is for landing *inside*
      // something (a row, a tab list, a card), where "which container" is the
      // question the placeholder alone doesn't answer.
      if (!parent || parent.getId() === editor.getWrapper()?.getId()) {
        return clear()
      }
      Canvas.addSpot({
        id: DROP_TARGET_SPOT,
        type: DROP_TARGET_SPOT,
        component: parent,
      })
    }

    editor.on("component:drag", onDrag)
    editor.on("component:drag:end", clear)

    return () => {
      editor.off("component:drag", onDrag)
      editor.off("component:drag:end", clear)
      clear()
    }
  }, [editor])

  // Mirror the spot collection into render state. `canvas:spot` covers adds,
  // updates, removals and every repositioning refresh (frame scroll, zoom,
  // component resize/update, undo/redo).
  useEffect(() => {
    if (!editor) return
    const sync = () =>
      setSpots(editor.Canvas.getSpots({ type: DROP_TARGET_SPOT }))
    sync()
    editor.on("canvas:spot", sync)
    return () => {
      editor.off("canvas:spot", sync)
    }
  }, [editor])

  if (!editor || !spots.length) return null
  const spotsEl = editor.Canvas.getSpotsEl()
  if (!spotsEl) return null

  return createPortal(
    spots.map((spot) => (
      <div
        key={spot.id}
        // Dashed + tinted so it reads as "this will receive the drop" rather
        // than the solid selection outline drawn inside the frame.
        className="bg-primary/5 outline-2 -outline-offset-2 outline-primary outline-dashed"
        style={spot.getStyle() as React.CSSProperties}
      />
    )),
    spotsEl
  )
}
