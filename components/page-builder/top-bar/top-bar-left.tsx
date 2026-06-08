"use client"

import * as React from "react"
import { useEditor } from "@grapesjs/react"
import { Layers, Plus, Redo, SquareDashed, Undo } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
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

  // Tracks the GrapesJS core outline command (runs the dashed-border overlay
  // on every component). The `update` listener above already re-renders this
  // bar on every editor change, but command run/stop don't fire `update` —
  // we sync local state from the run/stop events directly.
  const OUTLINE_CMD = "core:component-outline"
  const [outlineActive, setOutlineActive] = React.useState<boolean>(() =>
    editor.Commands.isActive(OUTLINE_CMD)
  )
  React.useEffect(() => {
    const sync = () => setOutlineActive(editor.Commands.isActive(OUTLINE_CMD))
    editor.on(`command:run:${OUTLINE_CMD}`, sync)
    editor.on(`command:stop:${OUTLINE_CMD}`, sync)
    return () => {
      editor.off(`command:run:${OUTLINE_CMD}`, sync)
      editor.off(`command:stop:${OUTLINE_CMD}`, sync)
    }
  }, [editor])
  const toggleOutline = () => {
    if (editor.Commands.isActive(OUTLINE_CMD)) editor.stopCommand(OUTLINE_CMD)
    else editor.runCommand(OUTLINE_CMD)
  }

  return (
    <TooltipProvider delay={500}>
      <div className={cn("flex items-center gap-1", className)}>
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

        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                size="sm"
                aria-label="Toggle outline"
                pressed={outlineActive}
                onPressedChange={toggleOutline}
                className="size-8 p-0"
              >
                <SquareDashed className="size-4" />
              </Toggle>
            }
          />
          <TooltipContent>Toggle outline</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
