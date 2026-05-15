"use client"

import * as React from "react"
import type {
  PropertyComposite,
  PropertyNumber,
  PropertySelect,
} from "grapesjs"

import {
  AllCustomField,
  AllCustomFieldControl,
  AllCustomFieldContent,
  AllCustomFieldItem,
  AllCustomSelectControl,
  AllCustomSelectItem,
} from "./all-custom-field"
import { CrossGrid, type Side } from "./box-sides-field"
import FlexPresetField, { getFlexPreset } from "./flex-preset-field"
import { usePropertyRenderer } from "./property-field-context"

type CompositeFieldProps = {
  property: PropertyComposite
}

export default function CompositeField({ property }: CompositeFieldProps) {
  const name = property.getName()
  const renderProperty = usePropertyRenderer()

  if (name === "margin" || name === "padding") {
    const subs = property.getProperties() as PropertyNumber[]
    const compositeName = property.getName()
    const bySide = (side: Side): PropertyNumber | undefined =>
      subs.find((s) => s.getName() === `${compositeName}-${side}`)
    return (
      <AllCustomField property={property}>
        <AllCustomFieldControl
          varCategories={["size"]}
          allTooltip="Apply one value to all four sides"
          customTooltip="Edit top, right, bottom, and left independently"
          ariaLabelSuffix="all sides"
        />
        <AllCustomFieldContent>
          <CrossGrid bySide={bySide} />
        </AllCustomFieldContent>
      </AllCustomField>
    )
  }

  if (name === "gap") {
    const subs = property.getProperties() as PropertyNumber[]
    const byName = (n: string) => subs.find((s) => s.getName() === n)
    return (
      <AllCustomField property={property}>
        <AllCustomFieldControl
          varCategories={["size"]}
          allTooltip="Apply one value to row and column"
          customTooltip="Edit row and column gap independently"
          ariaLabelSuffix="both axes"
        />
        <AllCustomFieldContent>
          <div className="grid grid-cols-2 gap-2">
            <AllCustomFieldItem sub={byName("row-gap")!} label="Row" />
            <AllCustomFieldItem sub={byName("column-gap")!} label="Column" />
          </div>
        </AllCustomFieldContent>
      </AllCustomField>
    )
  }

  if (name === "border-radius") {
    const subs = property.getProperties() as PropertyNumber[]
    const byName = (n: string) => subs.find((s) => s.getName() === n)
    return (
      <AllCustomField property={property}>
        <AllCustomFieldControl
          varCategories={["border-radius"]}
          allTooltip="Apply one value to all four corners"
          customTooltip="Edit each corner independently"
          ariaLabelSuffix="all corners"
        />
        <AllCustomFieldContent>
          <div className="grid grid-cols-2 gap-2">
            <AllCustomFieldItem
              sub={byName("border-top-left-radius")!}
              label="Top Left"
            />
            <AllCustomFieldItem
              sub={byName("border-top-right-radius")!}
              label="Top Right"
            />
            <AllCustomFieldItem
              sub={byName("border-bottom-left-radius")!}
              label="Bottom Left"
            />
            <AllCustomFieldItem
              sub={byName("border-bottom-right-radius")!}
              label="Bottom Right"
            />
          </div>
        </AllCustomFieldContent>
      </AllCustomField>
    )
  }

  if (name === "overflow") {
    const subs = property.getProperties() as PropertySelect[]
    const byName = (n: string) => subs.find((s) => s.getName() === n)
    const first = subs[0]
    const options = first?.getOptions
      ? first.getOptions().map((o) => ({
          id: first.getOptionId(o),
          label: first.getOptionLabel(o),
        }))
      : []
    return (
      <AllCustomField property={property}>
        <AllCustomSelectControl
          options={options}
          placeholder="Visible"
          allTooltip="Apply one value to both axes"
          customTooltip="Edit X and Y axes independently"
          ariaLabelSuffix="both axes"
        />
        <AllCustomFieldContent>
          <div className="grid grid-cols-2 gap-2">
            <AllCustomSelectItem sub={byName("overflow-x")} label="X" />
            <AllCustomSelectItem sub={byName("overflow-y")} label="Y" />
          </div>
        </AllCustomFieldContent>
      </AllCustomField>
    )
  }

  if (name === "flex") {
    return <FlexCompositeField property={property} />
  }

  const properties = property.getProperties()
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
      {properties.map((p) => (
        <React.Fragment key={p.getId()}>
          {renderProperty(p)}
        </React.Fragment>
      ))}
    </div>
  )
}

function FlexCompositeField({ property }: { property: PropertyComposite }) {
  const properties = property.getProperties()
  const preset = getFlexPreset(property)
  const [customForced, setCustomForced] = React.useState(false)
  const customActive = customForced || preset === null
  const renderProperty = usePropertyRenderer()

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
      <FlexPresetField
        property={property}
        customForced={customForced}
        onSelect={(id) => setCustomForced(id === "custom")}
      />
      {customActive
        ? properties.map((p) => (
            <React.Fragment key={p.getId()}>
              {renderProperty(p)}
            </React.Fragment>
          ))
        : null}
    </div>
  )
}
