import { useEditorMaybe } from "@grapesjs/react"
import { useEffect, useState } from "react"
import type { Component } from "grapesjs"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import { TEMPLATE_REF_TYPE } from "@/lib/plugins/template-ref"
import { cn } from "@/lib/utils"
import { CanvasFloating } from "./canvas-floating"
import { useCanvasDragging } from "./hooks/use-canvas-dragging"

// Custom hover badge. Mirrors the floating-toolbar pattern but anchored to the
// hovered component instead of the selected one. Hides while a component is
// being dragged (hover events get noisy) and while the hovered component is
// already selected (the toolbar already shows the name).
export function FloatingBadge() {
  const editor = useEditorMaybe()
  const [hovered, setHovered] = useState<Component | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const isDragging = useCanvasDragging()

  useEffect(() => {
    if (!editor) return

    const onHover = (cmp: Component) => setHovered(cmp)
    const onUnhover = () => setHovered(null)
    const onSelect = (cmp: Component) => setSelectedId(cmp?.getId() ?? null)
    const onDeselect = () => setSelectedId(null)
    const onRemove = (cmp: Component) => {
      setHovered((current) => (current === cmp ? null : current))
    }

    editor.on("component:hovered", onHover)
    editor.on("component:unhovered", onUnhover)
    editor.on("component:selected", onSelect)
    editor.on("component:deselected", onDeselect)
    editor.on("component:remove", onRemove)

    return () => {
      editor.off("component:hovered", onHover)
      editor.off("component:unhovered", onUnhover)
      editor.off("component:selected", onSelect)
      editor.off("component:deselected", onDeselect)
      editor.off("component:remove", onRemove)
    }
  }, [editor])

  if (!hovered || isDragging) return null
  if (hovered.getId() === selectedId) return null

  // Match the violet accent the canvas hover outline uses for synced
  // template refs (template-ref PLACEHOLDER_CSS) so badge + outline agree.
  const isTemplateRef = hovered.get("type") === TEMPLATE_REF_TYPE

  return (
    <CanvasFloating target={hovered} placement="top-end" pointerEvents="none">
      <ButtonGroup
        className={cn(
          "rounded-md shadow-lg",
          isTemplateRef ? "bg-violet-600" : "bg-primary"
        )}
      >
        <ButtonGroupText
          className={cn(
            "h-6 max-w-36 overflow-hidden border-0 bg-transparent px-2 text-xs font-medium text-ellipsis whitespace-nowrap",
            isTemplateRef ? "text-white" : "text-primary-foreground"
          )}
        >
          {hovered.getName()}
        </ButtonGroupText>
      </ButtonGroup>
    </CanvasFloating>
  )
}
