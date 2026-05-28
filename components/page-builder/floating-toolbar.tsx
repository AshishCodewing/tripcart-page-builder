import { useEditorMaybe } from "@grapesjs/react"
import { useEffect, useState } from "react"
import type { Component } from "grapesjs"
import { Copy, Trash2, ArrowUp, Move } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/components/ui/button-group"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CanvasFloating } from "./canvas-floating"

export function FloatingToolbar() {
  const editor = useEditorMaybe()
  const [selected, setSelected] = useState<Component | null>(null)

  useEffect(() => {
    if (!editor) return

    const onSelect = (cmp: Component) => setSelected(cmp)
    const onDeselect = () => setSelected(null)
    const onRemove = (cmp: Component) => {
      setSelected((current) => (current === cmp ? null : current))
    }

    editor.on("component:selected", onSelect)
    editor.on("component:deselected", onDeselect)
    editor.on("component:remove", onRemove)

    return () => {
      editor.off("component:selected", onSelect)
      editor.off("component:deselected", onDeselect)
      editor.off("component:remove", onRemove)
    }
  }, [editor])

  if (!selected) return null

  return (
    <CanvasFloating target={selected} placement="top-end">
      <TooltipProvider delay={300}>
        <ButtonGroup className="rounded-md bg-primary shadow-lg">
          <ButtonGroupText className="max-w-36 overflow-hidden text-ellipsis whitespace-nowrap border-0 bg-transparent px-2 text-xs font-medium text-primary-foreground">
            {selected.getName()}
          </ButtonGroupText>
          <ButtonGroupSeparator className="bg-primary-foreground/10" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-white"
                  onClick={() => editor?.runCommand("tlb-move")}
                >
                  <Move className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <TooltipContent>Move</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-white"
                  onClick={() => {
                    const parent = selected.parent()
                    if (parent) editor?.select(parent)
                  }}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <TooltipContent>Select parent</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-white"
                  onClick={() => {
                    const parent = selected.parent()
                    const idx = selected.index()
                    parent?.append(selected.clone(), { at: idx + 1 })
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <TooltipContent>Duplicate</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-white"
                  onClick={() => selected.remove()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </ButtonGroup>
      </TooltipProvider>
    </CanvasFloating>
  )
}
