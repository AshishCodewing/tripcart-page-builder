import { useEditorMaybe } from "@grapesjs/react"
import { useEffect, useState } from "react"
import type { Component } from "grapesjs"
import { Copy, Trash2, ArrowUp, Move, MoreVertical } from "lucide-react"
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
import {
  CONVERT_OPEN_EVENT,
  isConvertibleSelection,
} from "@/lib/plugins/convert-to-template"
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

  const canConvert = isConvertibleSelection(selected)

  return (
    <CanvasFloating target={selected} placement="top-end">
      <TooltipProvider delay={300}>
        <ButtonGroup className="bg-white rounded-lg">
          <ButtonGroupText className="max-w-36 overflow-hidden text-ellipsis whitespace-nowrap text-xs bg-primary text-white dark:bg-primary hover:bg-primary dark:hover:bg-primary border-0">
            {selected.getName()}
          </ButtonGroupText>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="outline"
                  className="bg-primary text-white dark:bg-primary hover:bg-primary/80 hover:text-white dark:hover:text-white dark:hover:bg-primary/80 border-0"
                  onClick={() => editor?.runCommand("tlb-move")}
                >
                  <Move />
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
                  variant="outline"
                  className="bg-primary text-white dark:bg-primary hover:bg-primary/80 hover:text-white dark:hover:text-white dark:hover:bg-primary/80 border-0"
                  onClick={() => {
                    const parent = selected.parent()
                    if (parent) editor?.select(parent)
                  }}
                >
                  <ArrowUp />
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
                  variant="outline"
                  className="bg-primary text-white dark:bg-primary hover:bg-primary/80 hover:text-white dark:hover:text-white dark:hover:bg-primary/80 border-0"
                  onClick={() => {
                    const parent = selected.parent()
                    const idx = selected.index()
                    parent?.append(selected.clone(), { at: idx + 1 })
                  }}
                >
                  <Copy />
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
                  variant="outline"
                  className="bg-primary text-white dark:bg-primary hover:bg-primary/80 hover:text-white dark:hover:text-white dark:hover:bg-primary/80 border-0"
                  onClick={() => selected.remove()}
                >
                  <Trash2 />
                </Button>
              }
            />
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
          {canConvert && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="outline"
                    className="bg-primary text-white dark:bg-primary hover:bg-primary/80 hover:text-white dark:hover:text-white dark:hover:bg-primary/80 border-0"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      editor?.trigger(CONVERT_OPEN_EVENT, {
                        rect: {
                          x: rect.left,
                          y: rect.bottom,
                          width: rect.width,
                        },
                      })
                    }}
                  >
                    <MoreVertical />
                  </Button>
                }
              />
              <TooltipContent>More</TooltipContent>
            </Tooltip>
          )}
        </ButtonGroup>
      </TooltipProvider>
    </CanvasFloating>
  )
}
