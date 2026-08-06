"use client"

import { useEditorMaybe } from "@grapesjs/react"
import { useEffect, useState } from "react"

/**
 * True while a component is being dragged on the canvas.
 *
 * The anchored floating chrome (<FloatingToolbar />, <FloatingBadge />) hides
 * for the duration: both are pinned to a component's box, so during a drag they
 * sit over the component's *original* position while the pointer is somewhere
 * else. GrapesJS does the same with its own toolbar — `tlb-move` calls
 * `hideTlb` before handing off to the sorter. <DragBadge /> is the chrome that
 * takes over, tracking the pointer instead of a box.
 *
 * Covers component drags only. New blocks dragged in from the Block Manager
 * emit `block:drag:*` instead and don't flip this.
 */
export function useCanvasDragging(): boolean {
  const editor = useEditorMaybe()
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (!editor) return

    const onDragStart = () => setIsDragging(true)
    const onDragEnd = () => setIsDragging(false)

    editor.on("component:drag:start", onDragStart)
    editor.on("component:drag:end", onDragEnd)

    return () => {
      editor.off("component:drag:start", onDragStart)
      editor.off("component:drag:end", onDragEnd)
    }
  }, [editor])

  return isDragging
}
