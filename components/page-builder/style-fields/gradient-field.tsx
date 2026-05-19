"use client"

import * as React from "react"
import type { Property, PropertyComposite } from "grapesjs"

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

// `grapesjs-style-bg` wires `background-image-gradient` into a composite
// whose `toStyle` re-assembles the final CSS as
// `toGradient(<-type sibling>, <-dir sibling>, parseGradient(<-gradient>).colors)`
// — i.e. it pulls type and direction from sibling sub-properties and only
// reads the colors out of our gradient string. So when the user changes the
// type or direction in our React picker, we have to update those siblings
// too or the composite will silently fall back to the old values.
const TYPE_SUBPROP = "background-image-gradient-type"
const DIR_SUBPROP = "background-image-gradient-dir"

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
      const parent = property.getParent?.() as PropertyComposite | undefined
      const parsedNext = parseGradient(next)
      if (parent && parsedNext) {
        parent.getProperty(TYPE_SUBPROP)?.upValue(parsedNext.type, opts)
        parent.getProperty(DIR_SUBPROP)?.upValue(parsedNext.direction, opts)
      }
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
