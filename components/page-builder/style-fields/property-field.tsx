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
import { cn } from "@/lib/utils"

import BaseField from "./base-field"
import ColorField from "./color-field"
import FileField from "./file-field"
import FlexPresetField from "./flex-preset-field"
import NumberField from "./number-field"
import RadioField from "./radio-field"
import SelectField from "./select-field"

// `Layer` (the PropertyStack layer model) is not exported from grapesjs's
// public types, so we derive it from the API surface that does return it.
type StackLayer = NonNullable<ReturnType<PropertyStack["getLayer"]>>

export default function PropertyField({ property }: { property: Property }) {
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
  const layout = type === "stack" || type === "composite" ? "block" : "inline"

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
        "flex gap-2",
        layout === "inline"
          ? "items-center justify-between"
          : "flex-col items-stretch"
      )}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-xs text-muted-foreground",
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
  const properties = property.getProperties()
  // The `flex` composite gets a preset picker on top of the sub-property rows,
  // matching the Auto / Fill / Hug radio the Studio SDK ships.
  const isFlexShorthand = property.getName() === "flex"

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
      {isFlexShorthand ? <FlexPresetField property={property} /> : null}
      {properties.map((p) => (
        <PropertyField key={p.getId()} property={p} />
      ))}
    </div>
  )
}

function StackField({ property }: { property: PropertyStack }) {
  const layers = property.getLayers()
  const selectedLayer = property.getSelectedLayer()

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
      <div className="flex flex-col gap-1">
        {layers.length === 0 ? (
          <p className="px-1 py-1 text-xs text-muted-foreground">
            No layers — add one to start.
          </p>
        ) : (
          layers.map((layer) => (
            <LayerRow
              key={layer.getId()}
              layer={layer}
              property={property}
              selected={selectedLayer?.getId() === layer.getId()}
            />
          ))
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 self-start text-xs"
        onClick={() => property.addLayer({}, { at: 0 })}
      >
        <Plus className="size-3" aria-hidden="true" />
        Add layer
      </Button>
      {selectedLayer ? (
        <div className="flex flex-col gap-2 rounded-md bg-background/60 p-2">
          {property.getProperties().map((p) => (
            <PropertyField key={p.getId()} property={p} />
          ))}
        </div>
      ) : null}
    </div>
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
    <div
      data-selected={selected || undefined}
      className={cn(
        "flex items-center gap-1.5 rounded-md border bg-background/40 px-2 py-1 transition-colors motion-reduce:transition-none",
        selected ? "border-primary/50" : "border-transparent hover:border-border"
      )}
    >
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-start text-xs"
        onClick={() => property.selectLayer(layer)}
      >
        {property.getLayerLabel(layer)}
      </button>
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
  )
}
