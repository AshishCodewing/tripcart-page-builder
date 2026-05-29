import { useEditorMaybe } from "@grapesjs/react"
import { useEffect, useState } from "react"
import type { Component } from "grapesjs"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import { CanvasFloating } from "./canvas-floating"

// Custom hover badge. Mirrors the floating-toolbar pattern but anchored to the
// hovered component instead of the selected one. Hides while a component is
// being dragged (hover events get noisy) and while the hovered component is
// already selected (the toolbar already shows the name).
export function FloatingBadge() {
  const editor = useEditorMaybe()
  const [hovered, setHovered] = useState<Component | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (!editor) return

    const onHover = (cmp: Component) => setHovered(cmp)
    const onUnhover = () => setHovered(null)
    const onSelect = (cmp: Component) => setSelectedId(cmp?.getId() ?? null)
    const onDeselect = () => setSelectedId(null)
    const onRemove = (cmp: Component) => {
      setHovered((current) => (current === cmp ? null : current))
    }
    const onDragStart = () => setIsDragging(true)
    const onDragEnd = () => setIsDragging(false)

    editor.on("component:hovered", onHover)
    editor.on("component:unhovered", onUnhover)
    editor.on("component:selected", onSelect)
    editor.on("component:deselected", onDeselect)
    editor.on("component:remove", onRemove)
    editor.on("component:drag:start", onDragStart)
    editor.on("component:drag:end", onDragEnd)

    return () => {
      editor.off("component:hovered", onHover)
      editor.off("component:unhovered", onUnhover)
      editor.off("component:selected", onSelect)
      editor.off("component:deselected", onDeselect)
      editor.off("component:remove", onRemove)
      editor.off("component:drag:start", onDragStart)
      editor.off("component:drag:end", onDragEnd)
    }
  }, [editor])

  if (!hovered || isDragging) return null
  if (hovered.getId() === selectedId) return null

  return (
    <CanvasFloating target={hovered} placement="top-end" pointerEvents="none">
      <ButtonGroup className="rounded-md bg-primary shadow-lg">
        <ButtonGroupText className="max-w-36 overflow-hidden text-ellipsis whitespace-nowrap border-0 bg-transparent px-2 h-6 text-xs font-medium text-primary-foreground">
          {hovered.getName()}
        </ButtonGroupText>
      </ButtonGroup>
    </CanvasFloating>
  )
}
