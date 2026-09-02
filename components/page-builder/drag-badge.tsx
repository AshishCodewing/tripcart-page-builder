import { useEditorMaybe } from "@grapesjs/react"
import { useEffect, useState } from "react"
import type { Component, ComponentDragEventData } from "grapesjs"
import { Ban, CornerDownRight } from "lucide-react"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import { cn } from "@/lib/utils"
import { CanvasFloating } from "./canvas-floating"

// Drag feedback badge — the replacement for the built-in `gjs-badge-warning`
// chrome, which the `move-comp` command used to recolor while a component was
// being dragged. That badge rides on GrapesJS' own hover badge element, so
// disabling the built-in `hover` canvas spot (build-options.ts) takes it out
// along with the rest.
//
// `component:drag` fires on every pointer move of a component drag with
// `{ target, parent, index }`. `parent` is the resolved drop parent, and is
// undefined whenever the pointer is over something that can't accept the
// dragged component (DropLocationDeterminer resets its move data before
// firing) — that's the "can't drop here" signal.
//
// Scope note: this covers component drags — dragging on the canvas and the
// floating toolbar's Move action — matching what the built-in badge covered.
// New blocks dragged in from the Block Manager emit `block:drag:*` instead and
// are not handled here. Neither are Layers-panel drags: that tree runs on
// @dnd-kit (`layerManager: { custom: true }` means GrapesJS' own sorter is
// never built), it emits no `component:drag*`, and it draws its own drop
// indicator inside the panel.

type DragState = {
  /** The component being dragged. Also gates mounting. */
  dragged: Component
  /** Resolved drop parent, or null when the pointer is over an invalid target. */
  parent: Component | null
  /** Pointer position in screen coordinates. */
  point: { x: number; y: number }
}

export function DragBadge() {
  const editor = useEditorMaybe()
  const [drag, setDrag] = useState<DragState | null>(null)

  useEffect(() => {
    if (!editor) return

    // Drag events can originate in either document: the canvas iframe (dragging
    // on the page) or the top document (dragging a row in the Layer Manager).
    // Only iframe-local coordinates need the frame offset added.
    const toScreen = (ev: MouseEvent) => {
      const frame = editor.Canvas.getFrameEl?.()
      const offset =
        frame && ev.view === frame.contentWindow
          ? frame.getBoundingClientRect()
          : null
      return {
        x: ev.clientX + (offset?.x ?? 0),
        y: ev.clientY + (offset?.y ?? 0),
      }
    }

    const onDrag = (data: ComponentDragEventData) => {
      const dragged = data.target
      // Duck-typed, not `instanceof MouseEvent`: canvas drags produce events
      // from the iframe's realm, whose MouseEvent constructor is a different
      // object than this document's — instanceof is false for every one.
      const ev = data.event as MouseEvent | undefined
      if (!dragged || typeof ev?.clientX !== "number") return
      setDrag({
        dragged,
        parent: data.parent ?? null,
        point: toScreen(ev),
      })
    }
    const onDragEnd = () => setDrag(null)

    editor.on("component:drag", onDrag)
    editor.on("component:drag:end", onDragEnd)

    return () => {
      editor.off("component:drag", onDrag)
      editor.off("component:drag:end", onDragEnd)
    }
  }, [editor])

  if (!drag) return null

  const canDrop = !!drag.parent

  return (
    <CanvasFloating
      target={drag.dragged}
      point={drag.point}
      placement="bottom-start"
      fallbacks={["top-start", "bottom-end"]}
      pointerEvents="none"
    >
      <ButtonGroup
        className={cn(
          "rounded-md shadow-lg",
          canDrop ? "bg-primary" : "bg-destructive"
        )}
      >
        <ButtonGroupText
          className={cn(
            "h-6 max-w-48 gap-1.5 overflow-hidden border-0 bg-transparent px-2 text-xs font-medium text-ellipsis whitespace-nowrap",
            canDrop ? "text-primary-foreground" : "text-white"
          )}
        >
          {canDrop ? (
            <>
              <CornerDownRight className="size-3 shrink-0" />
              {drag.parent?.getName()}
            </>
          ) : (
            <>
              <Ban className="size-3 shrink-0" />
              Can’t drop here
            </>
          )}
        </ButtonGroupText>
      </ButtonGroup>
    </CanvasFloating>
  )
}
