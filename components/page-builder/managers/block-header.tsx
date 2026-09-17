"use client"

import * as React from "react"
import { useEditor } from "@grapesjs/react"
import type { Component } from "grapesjs"
import {
  Ban,
  Braces,
  ChevronDown,
  Crosshair,
  MousePointer2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// "Neutral" is the empty state in GrapesJS — `Selectors.setState("")` clears
// it. The menu's radio group can't carry `""` as a value, so it uses a sentinel.
const NEUTRAL_VALUE = "__neutral__"

const STATE_ICON: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  "": Ban,
  hover: MousePointer2,
  focus: Crosshair,
}

type StateOption = { name: string; label: string }

/**
 * Top of the Block tab: the selected element's name, the style state
 * (Neutral / Hover / …) and the CSS code toggle. State lives here rather than
 * in the selector rows because it applies to both style views — the fields
 * and the code editor.
 */
export default function BlockHeader({
  codeView,
  onCodeViewChange,
}: {
  codeView: boolean
  onCodeViewChange: (next: boolean) => void
}) {
  const editor = useEditor()
  const [selected, setSelected] = React.useState<Component | null>(
    () => editor.getSelected() ?? null
  )
  const [name, setName] = React.useState(() => selected?.getName() ?? "")
  const [state, setStateValue] = React.useState(() =>
    editor.Selectors.getState()
  )

  const states = React.useMemo<StateOption[]>(
    () => [
      { name: "", label: "Neutral" },
      ...editor.Selectors.getStates().map((s) => ({
        name: s.getName(),
        label: s.getLabel(),
      })),
    ],
    [editor]
  )

  React.useEffect(() => {
    const refresh = () => {
      const cmp = editor.getSelected() ?? null
      setSelected(cmp)
      setName(cmp?.getName() ?? "")
    }
    const refreshState = () => setStateValue(editor.Selectors.getState())
    editor.on("component:selected", refresh)
    editor.on("component:deselected", refresh)
    editor.on("component:update:name", refresh)
    editor.on("selector:state", refreshState)
    return () => {
      editor.off("component:selected", refresh)
      editor.off("component:deselected", refresh)
      editor.off("component:update:name", refresh)
      editor.off("selector:state", refreshState)
    }
  }, [editor])

  if (!selected) return null

  const active = states.find((s) => s.name === state) ?? states[0]
  const ActiveIcon = STATE_ICON[active.name] ?? Crosshair

  return (
    <TooltipProvider delay={300}>
      <div className="flex min-h-11 items-center gap-1 border-b px-3 py-1.5">
        <h2
          className="min-w-0 flex-1 truncate text-sm font-semibold"
          translate="no"
          title={name}
        >
          {name}
        </h2>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="xs"
                aria-label={`Style state: ${active.label}`}
                className={cn(
                  "shrink-0",
                  active.name
                    ? "bg-accent text-primary"
                    : "text-muted-foreground"
                )}
              />
            }
          >
            <ActiveIcon aria-hidden="true" />
            {active.label}
            <ChevronDown className="opacity-60" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            <DropdownMenuRadioGroup
              value={active.name || NEUTRAL_VALUE}
              onValueChange={(value) =>
                editor.Selectors.setState(
                  value === NEUTRAL_VALUE ? "" : String(value)
                )
              }
            >
              {states.map((s) => {
                const Icon = STATE_ICON[s.name] ?? Crosshair
                return (
                  <DropdownMenuRadioItem
                    key={s.name || NEUTRAL_VALUE}
                    value={s.name || NEUTRAL_VALUE}
                  >
                    <Icon aria-hidden="true" />
                    {s.label}
                  </DropdownMenuRadioItem>
                )
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-pressed={codeView}
                aria-label="Edit CSS as code"
                onClick={() => onCodeViewChange(!codeView)}
                className={cn(
                  "shrink-0",
                  codeView ? "bg-accent text-primary" : "text-muted-foreground"
                )}
              >
                <Braces />
              </Button>
            }
          />
          <TooltipContent>Edit CSS as code</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
