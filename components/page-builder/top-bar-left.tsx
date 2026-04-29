"use client"

import * as React from "react"
import { useEditor } from "@grapesjs/react"
import { Layers, Plus, Redo, Undo } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import type { InserterMode } from "./inserter-sidebar"

type Props = React.HTMLAttributes<HTMLDivElement> & {
  /** null when the left sidebar is closed; mode name when open. */
  activeMode: InserterMode | null
  onInserterClick: (mode: InserterMode) => void
}

export default function TopBarLeft({
  className,
  activeMode,
  onInserterClick,
}: Props) {
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

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-1", className)}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="default"
                size="icon-sm"
                aria-label="Insert block"
                aria-pressed={blocksActive}
                onClick={() => onInserterClick("blocks")}
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
                onClick={() => onInserterClick("layers")}
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
