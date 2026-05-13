"use client"

import * as React from "react"
import type { PropertyStack } from "grapesjs"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import { usePropertyRenderer } from "./property-field-context"

type StackLayer = NonNullable<ReturnType<PropertyStack["getLayer"]>>

type StackFieldProps = {
  property: PropertyStack
}

export default function StackField({ property }: StackFieldProps) {
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

type LayerRowProps = {
  layer: StackLayer
  property: PropertyStack
  selected: boolean
}

function LayerRow({ layer, property, selected }: LayerRowProps) {
  const renderProperty = usePropertyRenderer()

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
          <React.Fragment key={p.getId()}>
            {renderProperty(p)}
          </React.Fragment>
        ))}
      </PopoverContent>
    </Popover>
  )
}
