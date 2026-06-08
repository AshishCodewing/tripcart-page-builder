"use client"

import { Square, SquareDashed } from "lucide-react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type ToggleMode = "all" | "custom"

export function AllCustomToggle({
  mode,
  onChange,
  ariaLabel,
  allTooltip,
  customTooltip,
}: {
  mode: ToggleMode
  onChange: (next: ToggleMode) => void
  ariaLabel: string
  allTooltip: string
  customTooltip: string
}) {
  return (
    <TooltipProvider delay={300}>
      <ToggleGroup
        variant="outline"
        value={[mode]}
        onValueChange={(values: string[]) => {
          const next = values[0] as ToggleMode | undefined
          if (next) onChange(next)
        }}
        aria-label={ariaLabel}
        className="self-end"
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <ToggleGroupItem
                value="all"
                aria-label={allTooltip}
                className="size-8 px-0"
              >
                <Square className="size-3.5" aria-hidden="true" />
              </ToggleGroupItem>
            }
          />
          <TooltipContent>{allTooltip}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <ToggleGroupItem
                value="custom"
                aria-label={customTooltip}
                className="size-8 px-0"
              >
                <SquareDashed className="size-3.5" aria-hidden="true" />
              </ToggleGroupItem>
            }
          />
          <TooltipContent>{customTooltip}</TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </TooltipProvider>
  )
}
