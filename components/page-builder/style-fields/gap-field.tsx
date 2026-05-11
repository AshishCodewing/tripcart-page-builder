"use client"

// Composite editor for the `gap` shorthand. Mirrors the BoxSidesField
// pattern but with two axes (row-gap, column-gap) instead of four sides:
//
//   • All    → one input that writes the same value to both axes.
//   • Custom → two NumberFields side-by-side, each wired to its own axis.

import * as React from "react"
import type { Property, PropertyComposite } from "grapesjs"

import { AllCustomToggle, type ToggleMode } from "./all-custom-toggle"
import { SideCell } from "./box-sides-field"
import { NumberInput } from "./number-field"

const AXES = ["row", "column"] as const
type Axis = (typeof AXES)[number]

const valueKey = (p: Property): string => p.getValue() ?? ""

function detectMode(subs: Property[]): ToggleMode {
  if (subs.length === 0) return "all"
  const first = valueKey(subs[0])
  return subs.every((s) => valueKey(s) === first) ? "all" : "custom"
}

export default function GapField({
  property,
}: {
  property: PropertyComposite
}) {
  const subs = property.getProperties() as Property[]
  const name = property.getName()
  const byAxis = (axis: Axis): Property | undefined =>
    subs.find((s) => s.getName() === `${axis}-gap`)

  // Same store-info-from-previous-render pattern as BoxSidesField — only
  // re-detect mode when the property identity changes (selection swap), not
  // mid-edit, so the user doesn't get yanked out of Custom while typing.
  const propertyId = property.getId()
  const [mode, setMode] = React.useState<ToggleMode>(() => detectMode(subs))
  const [trackedId, setTrackedId] = React.useState(propertyId)
  if (trackedId !== propertyId) {
    setTrackedId(propertyId)
    setMode(detectMode(subs))
  }

  const row = byAxis("row")
  const allAxesMatch =
    subs.length > 0 &&
    subs.every((s) => valueKey(s) === valueKey(subs[0]))
  const value =
    allAxesMatch && row?.getValue() != null ? String(row.getValue()) : ""

  const propagate = (
    raw: string,
    opts: { partial?: boolean } = {}
  ): void => {
    const trimmed = raw.trim()
    for (const s of subs) s.upValue(trimmed, opts)
  }

  const handleModeChange = (next: ToggleMode): void => {
    if (next === mode) return
    // Custom → All with differing values: snap both axes to row's value.
    if (next === "all" && row) {
      const current = row.getValue()
      propagate(current == null ? "" : String(current))
    }
    setMode(next)
  }

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-2 space-y-2">
      <div className="flex gap-2 items-center">
        <NumberInput
          value={value}
          placeholder={allAxesMatch ? "0" : "Custom"}
          ariaLabel={`${name} both axes`}
          onCommit={propagate}
        />
        <AllCustomToggle
          mode={mode}
          onChange={handleModeChange}
          ariaLabel={`${name} mode`}
          allTooltip="Apply one value to row and column"
          customTooltip="Edit row and column gap independently"
        />
      </div>
      {mode === "custom" && <AxisGrid byAxis={byAxis} />}
    </div>
  )
}

function AxisGrid({
  byAxis,
}: {
  byAxis: (axis: Axis) => Property | undefined
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {AXES.map((axis) => {
        const sub = byAxis(axis)
        if (!sub) return null
        return (
          <SideCell
            key={axis}
            sub={sub}
            label={sub.getLabel() || `${axis}-gap`}
          />
        )
      })}
    </div>
  )
}
