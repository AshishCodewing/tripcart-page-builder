"use client"

import type { PropertyComposite } from "grapesjs"

import {
  BorderRadiusField,
  FlexCompositeField,
  GapField,
  GenericCompositeField,
  GridAreaField,
  GridTemplateField,
  MarginPaddingField,
  OverflowField,
} from "./composite-field-shapes"

type CompositeFieldProps = {
  property: PropertyComposite
}

// Route a composite style property to its bespoke editor by name; anything
// unrecognized falls back to a generic per-sub-property render. Each shape's
// layout + lookups live in ./composite-field-shapes.
export default function CompositeField({ property }: CompositeFieldProps) {
  switch (property.getName()) {
    case "margin":
    case "padding":
      return <MarginPaddingField property={property} />
    case "gap":
      return <GapField property={property} />
    case "grid-template-columns":
    case "grid-template-rows":
      return <GridTemplateField property={property} />
    case "grid-area":
      return <GridAreaField property={property} />
    case "border-radius":
      return <BorderRadiusField property={property} />
    case "overflow":
      return <OverflowField property={property} />
    case "flex":
      return <FlexCompositeField property={property} />
    default:
      return <GenericCompositeField property={property} />
  }
}
