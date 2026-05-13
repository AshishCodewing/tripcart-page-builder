"use client"

import * as React from "react"
import type {
  Property,
  PropertyComposite,
  PropertyNumber,
  PropertySelect,
  PropertyStack,
} from "grapesjs"
import { Plus, RotateCcw, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import {
  AllCustomField,
  AllCustomFieldControl,
  AllCustomFieldContent,
  AllCustomFieldItem,
} from "./all-custom-field"
import BaseField from "./base-field"
import { CrossGrid, type Side } from "./box-sides-field"
import ColorField from "./color-field"
import FileField from "./file-field"
import FlexPresetField, { getFlexPreset } from "./flex-preset-field"
import NumberField from "./number-field"
import RadioField from "./radio-field"
import SelectField from "./select-field"

// `Layer` (the PropertyStack layer model) is not exported from grapesjs's
// public types, so we derive it from the API surface that does return it.
type StackLayer = NonNullable<ReturnType<PropertyStack["getLayer"]>>

// Radio fields that should stack their label above the toggle group. These
// render 4–6 icon buttons that don't fit cleanly inside the inline-layout
// max-w-[60%] field column.
const FLEX_AXIS_BLOCK_PROPS = new Set([
  "flex-direction",
  "justify-content",
  "align-items",
  "align-self",
  "align-content"
])

type PropertyFieldProps = {
  property: Property
}

export default function PropertyField({
  property,
}: PropertyFieldProps) {
  if (!property.isVisible()) return null

  const type = property.getType()
  let field: React.ReactNode

  switch (type) {
    case "length":
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
    <PropertyRow property={property} layout={layout}>
      {field}
    </PropertyRow>
  )
}

function PropertyRow({
  property,
  layout,
  children,
}: {
  property: Property
  layout: "inline" | "block"
  children: React.ReactNode
}) {
  const inherited = property.hasValueParent()
  const canClear = property.canClear()
  const label = property.getLabel()

  return (
    <div
      data-inherited={inherited || undefined}
      className={cn(
        "flex gap-1",
        layout === "inline"
          ? "items-center justify-between"
          : "flex-col items-stretch"
      )}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-xs text-muted-foreground py-1",
            inherited ? "flex items-center gap-2" : ""
          )}
        >
          {label}
          {inherited && <span className="size-1.5 shrink-0 rounded-full bg-warning"/>}
        </span>
        {canClear ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-5 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={`Clear ${label}`}
            onClick={() => property.clear()}
          >
            <RotateCcw className="size-3" aria-hidden="true" />
          </Button>
        ) : null}
        {property.getType() === "stack" ? (
          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                onClick={() => (property as PropertyStack).addLayer({}, { at: 0 })}
              >
                <Plus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Add {label.toLowerCase()} layer
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div
        className={cn(
          layout === "inline" ? "flex min-w-0 max-w-[60%] flex-1 items-center" : ""
        )}
      >
        {children}
      </div>
    </div>
  )
}

function CompositeField({ property }: { property: PropertyComposite }) {
  const name = property.getName()
  // `margin` and `padding` get the All / Custom toggle + cross layout — they
  // don't share the generic "stack of sub-rows" treatment.
  if (name === "margin" || name === "padding") {
    const subs = property.getProperties() as Property[]
    const compositeName = property.getName()
    const bySide = (side: Side): Property | undefined =>
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
  // `gap` uses the same All / Custom toggle but with two axes (row + column)
  // instead of four sides.
  if (name === "gap") {
    const subs = property.getProperties() as Property[]
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
  // `border-radius` uses the All / Custom toggle with a 2×2 corner grid.
  if (name === "border-radius") {
    const subs = property.getProperties() as Property[]
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
  // `flex` shows the Auto / Fill / Hug preset picker; the raw grow / shrink /
  // basis sub-rows are revealed only when Custom is active.
  if (name === "flex") {
    return <FlexCompositeField property={property} />
  }

  const properties = property.getProperties()
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
      {properties.map((p) => (
        <PropertyField key={p.getId()} property={p} />
      ))}
    </div>
  )
}

function FlexCompositeField({ property }: { property: PropertyComposite }) {
  const properties = property.getProperties()
  const preset = getFlexPreset(property)
  // Custom stays open until the user picks a preset; if the underlying values
  // don't match any preset, Custom is implicitly active so the sub-rows are
  // always reachable for editing.
  const [customForced, setCustomForced] = React.useState(false)
  const customActive = customForced || preset === null

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
      <FlexPresetField
        property={property}
        customForced={customForced}
        onSelect={(id) => setCustomForced(id === "custom")}
      />
      {customActive
        ? properties.map((p) => (
            <PropertyField key={p.getId()} property={p} />
          ))
        : null}
    </div>
  )
}

function StackField({ property }: { property: PropertyStack }) {
  const layers = property.getLayers()
  const selectedLayer = property.getSelectedLayer()

  return (
    <>
      {layers.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
          <div className="flex flex-col gap-1">
            {layers.map((layer) => (
              <LayerRow
                key={layer.getId()}
                layer={layer}
                property={property}
                selected={selectedLayer?.getId() === layer.getId()}
              />
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}

function LayerRow({
  layer,
  property,
  selected,
}: {
  layer: StackLayer
  property: PropertyStack
  selected: boolean
}) {
  return (
    <Popover>
      <div
        data-selected={selected || undefined}
        className={cn(
          "flex items-center gap-1.5 rounded-md border bg-background/40 px-2 py-1 transition-colors motion-reduce:transition-none",
          selected ? "border-primary/50" : "border-transparent hover:border-border"
        )}
      >
        <PopoverTrigger
          render={
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-start text-xs"
              onClick={() => property.selectLayer(layer)}
            />
          }
        >
          {property.getLayerLabel(layer)}
        </PopoverTrigger>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-5 text-muted-foreground hover:text-destructive"
          aria-label="Remove layer"
          onClick={() => property.removeLayer(layer)}
        >
          <Trash2 className="size-3" aria-hidden="true" />
        </Button>
      </div>
      <PopoverContent side="left" sideOffset={8} className="w-64 gap-2.5">
        {property.getProperties().map((p) => (
          <PropertyField key={p.getId()} property={p} />
        ))}
      </PopoverContent>
    </Popover>
  )
}
