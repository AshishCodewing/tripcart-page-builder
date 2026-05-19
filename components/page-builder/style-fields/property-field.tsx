"use client"

import type {
  Property,
  PropertyComposite,
  PropertyNumber,
  PropertySelect,
  PropertyStack,
} from "grapesjs"
import * as React from "react"


import BaseField from "./base-field"
import ColorField from "./color-field"
import CompositeField from "./composite-field"
import FileField from "./file-field"
import GradientField from "./gradient-field"
import NumberField from "./number-field"
import { PropertyFieldProvider } from "./property-field-context"
import PropertyRow from "./property-row"
import RadioField from "./radio-field"
import SelectField from "./select-field"
import StackField from "./stack-field"

// Radio fields that should stack their label above the toggle group. These
// render 4–6 icon buttons that don't fit cleanly inside the inline-layout
// max-w-[60%] field column.
const FLEX_AXIS_BLOCK_PROPS = new Set([
  "flex-direction",
  "justify-content",
  "align-items",
  "align-self",
  "align-content",
])

// Properties that always render block-layout regardless of type — typically
// because their control (slider + number combo, etc.) needs the full width.
// `__background-type` is the grapesjs-style-bg radio (Image / Color /
// Gradient); the plugin sets its label to `' '` so the row above is
// effectively empty and the toggle gets the full popover width.
const BLOCK_LAYOUT_PROPS = new Set([
  "opacity",
  "__background-type",
  // Grapick gradient picker — needs full width for the color-stop preview.
  "background-image-gradient",
  "background-color"
])

// Properties whose UI is folded into another field's interactive surface, so
// they shouldn't render their own row. GradientField wraps the
// GradientPicker compound, which already exposes Type + Angle/Position
// alongside the stops — but grapesjs-style-bg still registers separate
// `-dir` and `-type` selects so its composite fromStyle/toStyle pipeline
// can read them. We keep them registered and just don't draw them.
const HIDDEN_PROPERTY_NAMES = new Set([
  "background-image-gradient-dir",
  "background-image-gradient-type",
])

type PropertyFieldProps = {
  property: Property
}

export default function PropertyField({ property }: PropertyFieldProps) {
  if (!property.isVisible()) return null
  if (HIDDEN_PROPERTY_NAMES.has(property.getName())) return null

  const type = property.getType()
  let field: React.ReactNode

  switch (type) {
    case "number":
    case "integer":
    case "slider":
      field = (
        <NumberField
          property={property as PropertyNumber}
          slider={type === "slider"}
        />
      )
      break
    case "color":
      field = <ColorField property={property} />
      break
    case "select":
      field = <SelectField property={property as PropertySelect} />
      break
    case "radio":
      field = <RadioField property={property as PropertySelect} />
      break
    case "file":
      field = <FileField property={property} />
      break
    case "gradient":
      field = <GradientField property={property} />
      break
    case "stack":
      field = <StackField property={property as PropertyStack} />
      break
    case "composite":
      field = <CompositeField property={property as PropertyComposite} />
      break
    default:
      field = <BaseField property={property} />
  }

  // Stack/composite render their own headers (with layer rows or sub-fields),
  // so the row label would duplicate. Plain leaves get the standard label row.
  // Flex-axis radios stack the label above the toggle group so the 4–6 icon
  // buttons get full width instead of being crammed into max-w-[60%].
  const isFlexAxisRadio =
    type === "radio" && FLEX_AXIS_BLOCK_PROPS.has(property.getName())
  const isBlockByName = BLOCK_LAYOUT_PROPS.has(property.getName())
  const layout =
    type === "stack" ||
    type === "composite" ||
    isFlexAxisRadio ||
    isBlockByName
      ? "block"
      : "inline"

  return (
    <PropertyFieldProvider value={(p) => <PropertyField property={p} />}>
      <PropertyRow property={property} layout={layout}>
        {field}
      </PropertyRow>
    </PropertyFieldProvider>
  )
}
