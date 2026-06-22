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
import {
  extractSelectOptions,
  findSub,
  findSubBySide,
} from "./composite-field-helpers"

type ShapeProps = { property: PropertyComposite }

// margin / padding — one value for all four sides, or per-side editing.
export function MarginPaddingField({ property }: ShapeProps) {
  const bySide = (side: Side): PropertyNumber | undefined =>
    findSubBySide(property, side) as PropertyNumber | undefined
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

// gap — one value for both axes, or row/column independently.
export function GapField({ property }: ShapeProps) {
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
          <AllCustomFieldItem
            sub={findSub(property, "row-gap") as PropertyNumber}
            label="Row"
          />
          <AllCustomFieldItem
            sub={findSub(property, "column-gap") as PropertyNumber}
            label="Column"
          />
        </div>
      </AllCustomFieldContent>
    </AllCustomField>
  )
}

// grid-template-columns / grid-template-rows — fixed-track count + min/max.
export function GridTemplateField({ property }: ShapeProps) {
  const name = property.getName()
  const mode = findSub(property, `${name}-mode`) as PropertySelect | undefined
  const repeat = findSub(property, `${name}-repeat`) as
    | PropertyNumber
    | undefined
  const min = findSub(property, `${name}-min`) as PropertyNumber | undefined
  const max = findSub(property, `${name}-max`) as PropertyNumber | undefined
  const isFixed = ((mode?.getValue() as string) || "fixed") === "fixed"
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

// grid-area — row/column start & end.
export function GridAreaField({ property }: ShapeProps) {
  const items = [
    { name: "grid-row-start", label: "Row start" },
    { name: "grid-row-end", label: "Row end" },
    { name: "grid-column-start", label: "Column start" },
    { name: "grid-column-end", label: "Column end" },
  ]
  return (
    <div className="grid grid-cols-2 gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
      {items.map(({ name, label }) => {
        const sub = findSub(property, name) as PropertyNumber | undefined
        return sub ? (
          <AllCustomFieldItem key={name} sub={sub} label={label} />
        ) : null
      })}
    </div>
  )
}

// border-radius — one value for all corners, or per-corner editing.
export function BorderRadiusField({ property }: ShapeProps) {
  const corners = [
    { name: "border-top-left-radius", label: "Top Left" },
    { name: "border-top-right-radius", label: "Top Right" },
    { name: "border-bottom-left-radius", label: "Bottom Left" },
    { name: "border-bottom-right-radius", label: "Bottom Right" },
  ]
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
          {corners.map(({ name, label }) => (
            <AllCustomFieldItem
              key={name}
              sub={findSub(property, name) as PropertyNumber}
              label={label}
            />
          ))}
        </div>
      </AllCustomFieldContent>
    </AllCustomField>
  )
}

// overflow — one value for both axes, or X/Y independently.
export function OverflowField({ property }: ShapeProps) {
  const subs = property.getProperties() as PropertySelect[]
  return (
    <AllCustomField property={property}>
      <AllCustomSelectControl
        options={extractSelectOptions(subs[0])}
        placeholder="Visible"
        allTooltip="Apply one value to both axes"
        customTooltip="Edit X and Y axes independently"
        ariaLabelSuffix="both axes"
      />
      <AllCustomFieldContent>
        <div className="grid grid-cols-2 gap-2">
          <AllCustomSelectItem
            sub={findSub(property, "overflow-x") as PropertySelect | undefined}
            label="X"
          />
          <AllCustomSelectItem
            sub={findSub(property, "overflow-y") as PropertySelect | undefined}
            label="Y"
          />
        </div>
      </AllCustomFieldContent>
    </AllCustomField>
  )
}

// flex — preset toggle that reveals the raw sub-properties when "custom".
export function FlexCompositeField({ property }: ShapeProps) {
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

// Fallback: render every sub-property generically.
export function GenericCompositeField({ property }: ShapeProps) {
  const renderProperty = usePropertyRenderer()
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
      {property.getProperties().map((p) => (
        <React.Fragment key={p.getId()}>{renderProperty(p)}</React.Fragment>
      ))}
    </div>
  )
}
