"use client"

// Composite editor for `border-radius`. Same All / Custom toggle pattern as
// BoxSidesField (margin/padding) but four corners on a 2×2 grid instead of
// the cross layout:
//
//   [ Top Left ]   [ Top Right    ]
//   [ Bot Left ]   [ Bottom Right ]

import * as React from "react"
import type { Property, PropertyComposite } from "grapesjs"

import { AllCustomToggle, type ToggleMode } from "./all-custom-toggle"
import { SideCell } from "./box-sides-field"
import { NumberInput } from "./number-field"

type Corner = "top-left" | "top-right" | "bottom-right" | "bottom-left"

const CORNERS: Corner[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
]

const valueKey = (p: Property): string => p.getValue() ?? ""

function detectMode(subs: Property[]): ToggleMode {
  if (subs.length === 0) return "all"
  const first = valueKey(subs[0])
  return subs.every((s) => valueKey(s) === first) ? "all" : "custom"
}

// border-radius's CSS sub-properties wrap the corner key:
//   border-top-left-radius, border-top-right-radius, etc.
// Other corner-shaped composites (none today) would use `${parent}-${corner}`.
function subName(parent: string, corner: Corner): string {
  if (parent === "border-radius") return `border-${corner}-radius`
  return `${parent}-${corner}`
}

export default function BoxCornersField({
  property,
}: {
  property: PropertyComposite
}) {
  const subs = property.getProperties() as Property[]
  const name = property.getName()
  const byCorner = (corner: Corner): Property | undefined =>
    subs.find((s) => s.getName() === subName(name, corner))

  // Same store-info-from-previous-render pattern as BoxSidesField — only
  // re-detect mode when the property identity changes (selection swap).
  const propertyId = property.getId()
  const [mode, setMode] = React.useState<ToggleMode>(() => detectMode(subs))
  const [trackedId, setTrackedId] = React.useState(propertyId)
  if (trackedId !== propertyId) {
    setTrackedId(propertyId)
    setMode(detectMode(subs))
  }

  const tl = byCorner("top-left")
  const allCornersMatch =
    subs.length > 0 &&
    subs.every((s) => valueKey(s) === valueKey(subs[0]))
  const value =
    allCornersMatch && tl?.getValue() != null ? String(tl.getValue()) : ""

  const propagate = (
    raw: string,
    opts: { partial?: boolean } = {}
  ): void => {
    const trimmed = raw.trim()
    for (const s of subs) s.upValue(trimmed, opts)
  }

  const handleModeChange = (next: ToggleMode): void => {
    if (next === mode) return
    // Custom → All with differing values: snap all four to top-left's value.
    if (next === "all" && tl) {
      const current = tl.getValue()
      propagate(current == null ? "" : String(current))
    }
    setMode(next)
  }

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-2 space-y-2">
      <div className="flex gap-2 items-center">
        <NumberInput
          value={value}
          placeholder={allCornersMatch ? "0" : "Custom"}
          ariaLabel={`${name} all corners`}
          varCategories={["border-radius"]}
          onCommit={propagate}
        />
        <AllCustomToggle
          mode={mode}
          onChange={handleModeChange}
          ariaLabel={`${name} mode`}
          allTooltip="Apply one value to all four corners"
          customTooltip="Edit each corner independently"
        />
      </div>
      {mode === "custom" && <CornerGrid byCorner={byCorner} />}
    </div>
  )
}

function CornerGrid({
  byCorner,
}: {
  byCorner: (corner: Corner) => Property | undefined
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CORNERS.map((corner) => {
        const sub = byCorner(corner)
        if (!sub) return null
        return (
          <SideCell
            key={corner}
            sub={sub}
            label={corner.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
          />
        )
      })}
    </div>
  )
}
