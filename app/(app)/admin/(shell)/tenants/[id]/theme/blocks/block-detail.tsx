"use client"

import { ChevronLeftIcon, MoreVerticalIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { StyleBookEntry } from "@/lib/theme/style-book"
import type { StyleTarget } from "@/lib/theme/style-targets"
import { themeStore } from "@/lib/theme/theme-store"

import TargetSelectors from "./target-selectors"
import ThemeStylePanel from "./theme-style-panel"

type Props = {
  entry: StyleBookEntry
  target: StyleTarget
  variation: string | null
  part: string | null
  state: string | null
  onBack: () => void
  onVariationChange: (next: string | null) => void
  onPartChange: (next: string | null) => void
  onStateChange: (next: string | null) => void
}

/** One block's controls: what to edit (selectors) and how (style groups). */
export default function BlockDetail({
  entry,
  target,
  variation,
  part,
  state,
  onBack,
  onVariationChange,
  onPartChange,
  onStateChange,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onBack}
          aria-label="Back to all blocks"
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
        </Button>
        <h2 className="flex-1 text-sm font-semibold">{entry.label}</h2>

        {/* Tucked in a menu, as WP does: it wipes every change to this block
            (all variations, parts and states) in the draft. `Discard` in the
            footer is the undo until Save. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`${entry.label} options`}
              >
                <MoreVerticalIcon className="size-4" aria-hidden="true" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => themeStore.resetStyleBlock(target)}
            >
              <RotateCcwIcon className="size-4" aria-hidden="true" />
              Reset styles
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <TargetSelectors
        entry={entry}
        target={target}
        variation={variation}
        part={part}
        state={state}
        onVariationChange={onVariationChange}
        onPartChange={onPartChange}
        onStateChange={onStateChange}
      />

      <ThemeStylePanel target={target} />
    </div>
  )
}
