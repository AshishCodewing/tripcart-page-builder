"use client"

import * as React from "react"
import type { PropertyStack } from "grapesjs"
import { GripVertical, Trash2 } from "lucide-react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

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

  const sensors = useSensors(
    // Small activation distance so a click on the handle doesn't fire a drag
    // when the user just wanted to focus it. 4px is the dnd-kit recommendation.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = layers.findIndex((l) => l.getId() === active.id)
    const to = layers.findIndex((l) => l.getId() === over.id)
    if (from < 0 || to < 0) return
    property.moveLayer(layers[from], to)
  }

  return (
    <>
      {layers.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={layers.map((l) => l.getId())}
              strategy={verticalListSortingStrategy}
            >
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
            </SortableContext>
          </DndContext>
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

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.getId() })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <Popover>
      <div
        ref={setNodeRef}
        style={style}
        data-selected={selected || undefined}
        data-dragging={isDragging || undefined}
        className={cn(
          "flex items-center gap-1.5 rounded-md border bg-background/40 px-2 py-1 transition-colors motion-reduce:transition-none",
          selected
            ? "border-primary/50"
            : "border-transparent hover:border-border",
          isDragging && "z-10 shadow-md ring-1 ring-border"
        )}
      >
        <button
          type="button"
          className="flex size-5 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
          aria-label="Reorder layer"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3" aria-hidden="true" />
        </button>
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
          <React.Fragment key={p.getId()}>{renderProperty(p)}</React.Fragment>
        ))}
      </PopoverContent>
    </Popover>
  )
}
