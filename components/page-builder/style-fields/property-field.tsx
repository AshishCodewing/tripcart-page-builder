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

type PropertyFieldProps = {
  property: Property
}

export default function PropertyField({ property }: PropertyFieldProps) {
  if (!property.isVisible()) return null

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
  const layout =
    type === "stack" || type === "composite" || isFlexAxisRadio
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
