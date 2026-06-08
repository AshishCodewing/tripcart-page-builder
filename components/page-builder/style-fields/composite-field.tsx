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
import NumberField from "./number-field"
import { usePropertyRenderer } from "./property-field-context"
import SelectField from "./select-field"

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

  if (name === "grid-template-columns" || name === "grid-template-rows") {
    const subs = property.getProperties()
    const byName = (n: string) => subs.find((s) => s.getName() === n)
    const mode = byName(`${name}-mode`) as PropertySelect | undefined
    const repeat = byName(`${name}-repeat`) as PropertyNumber | undefined
    const min = byName(`${name}-min`) as PropertyNumber | undefined
    const max = byName(`${name}-max`) as PropertyNumber | undefined
    const modeValue = (mode?.getValue() as string) || "fixed"
    const isFixed = modeValue === "fixed"
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
        <div className="flex gap-2">
          {isFixed && repeat ? (
            <div className="w-20 shrink-0">
              <NumberField property={repeat} slider={false} />
            </div>
          ) : null}
          {mode ? (
            <div className="min-w-0 flex-1">
              <SelectField property={mode} />
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {min ? <AllCustomFieldItem sub={min} label="Min size" /> : null}
          {max ? <AllCustomFieldItem sub={max} label="Max size" /> : null}
        </div>
      </div>
    )
  }

  if (name === "grid-area") {
    const subs = property.getProperties() as PropertyNumber[]
    const byName = (n: string) => subs.find((s) => s.getName() === n)
    const rowStart = byName("grid-row-start")
    const rowEnd = byName("grid-row-end")
    const colStart = byName("grid-column-start")
    const colEnd = byName("grid-column-end")
    return (
      <div className="grid grid-cols-2 gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
        {rowStart ? (
          <AllCustomFieldItem sub={rowStart} label="Row start" />
        ) : null}
        {rowEnd ? <AllCustomFieldItem sub={rowEnd} label="Row end" /> : null}
        {colStart ? (
          <AllCustomFieldItem sub={colStart} label="Column start" />
        ) : null}
        {colEnd ? <AllCustomFieldItem sub={colEnd} label="Column end" /> : null}
      </div>
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
        <React.Fragment key={p.getId()}>{renderProperty(p)}</React.Fragment>
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
            <React.Fragment key={p.getId()}>{renderProperty(p)}</React.Fragment>
          ))
        : null}
    </div>
  )
}
