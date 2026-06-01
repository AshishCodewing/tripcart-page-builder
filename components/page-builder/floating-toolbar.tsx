import { useEditorMaybe } from "@grapesjs/react"
import { useEffect, useState } from "react"
import type { Component } from "grapesjs"
import { Copy, Trash2, ArrowUp, Move, MoreVertical, Pencil } from "lucide-react"
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
import {
  TEMPLATE_REF_SLUG_ATTR,
  TEMPLATE_REF_TYPE,
} from "@/lib/plugins/template-ref"
import { cn } from "@/lib/utils"
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

  // Synced-template refs get a distinct accent (matches the canvas
  // selection/hover outline set in template-ref's PLACEHOLDER_CSS) so the
  // toolbar reads as "this is a linked template, not a plain component".
  const isTemplateRef = selected.get("type") === TEMPLATE_REF_TYPE
  const btnClass = cn(
    "border-0 text-white hover:text-white dark:hover:text-white",
    isTemplateRef
      ? "bg-violet-600 hover:bg-violet-600/80 dark:bg-violet-600 dark:hover:bg-violet-600/80"
      : "bg-primary hover:bg-primary/80 dark:bg-primary dark:hover:bg-primary/80"
  )
  const labelClass = cn(
    "max-w-36 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-white border-0",
    isTemplateRef
      ? "bg-violet-600 hover:bg-violet-600 dark:bg-violet-600 dark:hover:bg-violet-600"
      : "bg-primary hover:bg-primary dark:bg-primary dark:hover:bg-primary"
  )

  return (
    <CanvasFloating target={selected} placement="top-end">
      <TooltipProvider delay={300}>
        <ButtonGroup className="bg-white rounded-lg">
          <ButtonGroupText className={labelClass}>
            {selected.getName()}
          </ButtonGroupText>
          {isTemplateRef && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="outline"
                    className={btnClass}
                    onClick={() => {
                      const slug =
                        selected.getAttributes()[TEMPLATE_REF_SLUG_ATTR] ?? ""
                      editor?.runCommand("tc:edit-template-ref", { slug })
                    }}
                  >
                    <Pencil />
                  </Button>
                }
              />
              <TooltipContent>Edit Original</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="outline"
                  className={btnClass}
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
                  className={btnClass}
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
                  className={btnClass}
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
                  className={btnClass}
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
                    className={btnClass}
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
