"use client"

import * as React from "react"
import type { Property } from "grapesjs"

import { Button } from "@/components/ui/button"
import {
  GradientPicker,
  GradientPickerAngle,
  GradientPickerColor,
  GradientPickerFields,
  GradientPickerFlip,
  GradientPickerStop,
  GradientPickerTrack,
  GradientPickerType,
} from "@/components/ui/gradient-picker"
import { DEFAULT_GRADIENT, parseGradient, toGradient } from "@/lib/gradient"

import BaseField from "./base-field"

const DEFAULT_CSS = toGradient(
  DEFAULT_GRADIENT.type,
  DEFAULT_GRADIENT.direction,
  DEFAULT_GRADIENT.stops
)

export default function GradientField({
  property,
}: {
  property: Property
}) {
  const value = String(property.getValue() ?? "")
  // Render the unparseable fallback for values like `var(--brand-gradient)`
  // that we can't model as stops.
  const parsed = React.useMemo(() => parseGradient(value), [value])

  const onChange = React.useCallback(
    (next: string, opts?: { partial?: boolean }) => {
      property.upValue(next, opts)
    },
    [property]
  )

  if (!parsed) {
    return (
      <div className="flex w-full flex-col gap-2">
        <BaseField property={property} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => property.upValue(DEFAULT_CSS)}
        >
          Reset to gradient
        </Button>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-2.5">
      <GradientPicker value={value} onChange={onChange}>
        <GradientPickerTrack />
        <GradientPickerFlip />
        <GradientPickerFields>
          <GradientPickerColor />
          <GradientPickerStop />
          <GradientPickerType />
          <GradientPickerAngle />
        </GradientPickerFields>
      </GradientPicker>
      <BaseField property={property} />
    </div>
  )
}
