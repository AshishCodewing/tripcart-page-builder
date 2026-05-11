"use client"

// Box-shorthand composite editor for `margin` and `padding`. Renders a
// per-composite All / Custom toggle plus the corresponding body:
//
//   • All    → one input that writes the same value to all four
//              sub-properties (top / right / bottom / left).
//   • Custom → cross layout (Top centered, Left/Right side-by-side, Bottom
//              centered) with each side wired to its own sub-property.

import * as React from "react"
import type { Property, PropertyComposite } from "grapesjs"
import { RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { AllCustomToggle, type ToggleMode } from "./all-custom-toggle"
import NumberField, { NumberInput } from "./number-field"

export type Side = "top" | "right" | "bottom" | "left"

const SIDES: Side[] = ["top", "right", "bottom", "left"]

const valueKey = (p: Property): string => p.getValue() ?? ""

function detectMode(subs: Property[]): ToggleMode {
  if (subs.length === 0) return "all"
  const first = valueKey(subs[0])
  return subs.every((s) => valueKey(s) === first) ? "all" : "custom"
}

export default function BoxSidesField({
  property,
}: {
  property: PropertyComposite
}) {
  const subs = property.getProperties() as Property[]
  const name = property.getName()
  const bySide = (side: Side): Property | undefined =>
    subs.find((s) => s.getName() === `${name}-${side}`)

  // Lazy-init mode from current values; only re-detect when the property
  // identity changes (selection swap). Mid-edit value churn must not auto-
  // flip the user out of Custom mode. Using the React-recommended
  // "store-info-from-previous-render" pattern to reset state on prop change
  // without the useEffect → setState cascade.
  const propertyId = property.getId()
  const [mode, setMode] = React.useState<ToggleMode>(() => detectMode(subs))
  const [trackedId, setTrackedId] = React.useState(propertyId)
  if (trackedId !== propertyId) {
    setTrackedId(propertyId)
    setMode(detectMode(subs))
  }

  const top = bySide("top")
  const allSidesMatch =
    subs.length > 0 &&
    subs.every((s) => valueKey(s) === valueKey(subs[0]))
  const value =
    allSidesMatch && top?.getValue() != null ? String(top.getValue()) : ""

  const propagate = (
    raw: string,
    opts: { partial?: boolean } = {}
  ): void => {
    const trimmed = raw.trim()
    for (const s of subs) s.upValue(trimmed, opts)
  }

  const handleModeChange = (next: ToggleMode): void => {
    if (next === mode) return
    // Custom → All with differing values: snap all four to Top's current value.
    if (next === "all" && top) {
      const current = top.getValue()
      propagate(current == null ? "" : String(current))
    }
    setMode(next)
  }

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-2 space-y-2">
      <div className="flex gap-2 items-center">
        <NumberInput
          value={value}
          placeholder={allSidesMatch ? "0" : "Custom"}
          ariaLabel={`${name} all sides`}
          varCategories={["size"]}
          onCommit={propagate}
        />
        <AllCustomToggle
          mode={mode}
          onChange={handleModeChange}
          ariaLabel={`${name} mode`}
          allTooltip="Apply one value to all four sides"
          customTooltip="Edit top, right, bottom, and left independently"
        />
      </div>
      {mode === "custom" && <CrossGrid bySide={bySide} />}
    </div>
  )
}

export function CrossGrid({
  bySide,
}: {
  bySide: (side: Side) => Property | undefined
}) {
  return (
    <div className="grid grid-cols-6 grid-rows-3 gap-4">
      {SIDES.map((side) => {
        const sub = bySide(side)
        if (!sub) return null
        return (
          <SideCell
            key={side}
            sub={sub}
            label={sub.getLabel() || side}
            className={POSITION[side]}
          />
        )
      })}
    </div>
  )
}

const POSITION: Record<Side, string> = {
  top: "col-start-2 row-start-1 col-end-6",
  left: "col-start-1 row-start-2 col-end-4",
  right: "col-start-4 row-start-2 col-end-7",
  bottom: "col-start-2 row-start-3 col-end-6",
}

export function SideCell({
  sub,
  label,
  className,
}: {
  sub: Property
  label: string
  className?: string
}) {
  const canClear = sub.canClear()
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-center gap-1 px-0.5">
        <span className="text-center text-xs text-muted-foreground">
          {label}
        </span>
        {canClear ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-4 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={`Clear ${label}`}
            onClick={() => sub.clear()}
          >
            <RotateCcw className="size-3" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <NumberField property={sub} slider={false} />
    </div>
  )
}
