"use client"

import * as React from "react"
import { useEditor } from "@grapesjs/react"
import { Layers, Palette, Plus, Redo, Undo } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { useLeftPanel } from "../left-panel/left-panel-context"

type Props = React.HTMLAttributes<HTMLDivElement>

export default function TopBarLeft({ className }: Props) {
  const { activeMode, togglePanel } = useLeftPanel()
  const editor = useEditor()
  const [, setTick] = React.useState(0)
  const { UndoManager } = editor

  React.useEffect(() => {
    const tick = () => setTick((v) => v + 1)
    editor.on("update", tick)
    return () => {
      editor.off("update", tick)
    }
  }, [editor])

  const blocksActive = activeMode === "blocks"
  const layersActive = activeMode === "layers"
  const themeActive = activeMode === "theme"

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-1", className)}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Theme"
                aria-pressed={themeActive}
                onClick={() => togglePanel("theme")}
                className={cn(
                  themeActive && "bg-accent text-accent-foreground"
                )}
              >
                <Palette />
              </Button>
            }
          />
          <TooltipContent>Theme</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Insert block"
                aria-pressed={blocksActive}
                onClick={() => togglePanel("blocks")}
                className={cn(
                  blocksActive && "bg-accent text-accent-foreground"
                )}
              >
                <Plus />
              </Button>
            }
          />
          <TooltipContent>Insert block</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Undo"
                disabled={!UndoManager.hasUndo()}
                onClick={() => UndoManager.undo()}
              >
                <Undo />
              </Button>
            }
          />
          <TooltipContent>Undo</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Redo"
                disabled={!UndoManager.hasRedo()}
                onClick={() => UndoManager.redo()}
              >
                <Redo />
              </Button>
            }
          />
          <TooltipContent>Redo</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Layers"
                aria-pressed={layersActive}
                onClick={() => togglePanel("layers")}
                className={cn(
                  layersActive && "bg-accent text-accent-foreground"
                )}
              >
                <Layers />
              </Button>
            }
          />
          <TooltipContent>Layers</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
