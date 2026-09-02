"use client"

import { useMemo, useState } from "react"
import {
  DndContext,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import type { LayerData } from "grapesjs"
import { Layers } from "lucide-react"

import { SidebarContent } from "@/components/ui/sidebar"

import LayerRow, { INDENT_WIDTH } from "./layers/layer-row"
import { canDropLayer, moveLayer, type LayerDrop } from "./layers/move-layer"
import { excludeDescendants, projectDrop } from "./layers/drop-projection"
import { useLayerTree, type LayerRow as Row } from "./layers/use-layer-tree"

export default function LayersPanel() {
  const { editor, rows, componentById, root } = useLayerTree()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [offsetLeft, setOffsetLeft] = useState(0)

  const sensors = useSensors(
    // 4px before a drag starts, so clicking a row still selects it.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // A branch can't be dropped into itself, and its children would skew the
  // depth maths, so they leave the list for the duration of the drag.
  const visibleRows = useMemo(
    () => (activeId ? excludeDescendants(rows, activeId) : rows),
    [rows, activeId]
  )

  const projection =
    activeId && overId
      ? projectDrop({
          rows: visibleRows,
          activeId,
          overId,
          dragOffsetLeft: offsetLeft,
          indentWidth: INDENT_WIDTH,
        })
      : null

  const drop: LayerDrop | null = useMemo(() => {
    if (!projection || !root) return null
    const parent =
      projection.parentId === null
        ? root
        : componentById.get(projection.parentId)
    if (!parent) return null
    return {
      parent,
      before: projection.beforeId
        ? (componentById.get(projection.beforeId) ?? null)
        : null,
    }
  }, [projection, root, componentById])

  const source = activeId ? componentById.get(activeId) : undefined
  const canDrop = !!(
    editor &&
    source &&
    drop &&
    canDropLayer(editor, source, drop)
  )

  const reset = () => {
    setActiveId(null)
    setOverId(null)
    setOffsetLeft(0)
  }

  const handleDragEnd = ({ over }: DragEndEvent) => {
    if (over && editor && source && drop && canDrop) {
      moveLayer(editor, source, drop)
    }
    reset()
  }

  if (!editor || rows.length === 0) return <EmptyState />

  // Every write goes through `setLayerData`: it stamps `fromLayers: true`, the
  // flag LayerManager.componentChanged early-returns on, so a change we make
  // here never bounces back as a tree rebuild.
  const write = (row: Row, data: Partial<Omit<LayerData, "components">>) =>
    editor.Layers.setLayerData(row.component, data)

  // Hiding a layer writes `display: none` into the component's own style
  // (LayerManager.setVisible stashes the previous value in a `__prev-display`
  // prop). That is saved with the draft and ships to the published page — it is
  // not an editor-only preview toggle.
  const toggleVisible = (row: Row) => write(row, { visible: !row.visible })

  return (
    <SidebarContent className="p-1">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={({ active }: DragStartEvent) =>
          setActiveId(String(active.id))
        }
        onDragMove={({ delta }: DragMoveEvent) => setOffsetLeft(delta.x)}
        onDragOver={({ over }: DragOverEvent) =>
          setOverId(over ? String(over.id) : null)
        }
        onDragEnd={handleDragEnd}
        onDragCancel={reset}
      >
        <SortableContext
          items={visibleRows.map((row) => row.id)}
          strategy={verticalListSortingStrategy}
        >
          <div role="tree" aria-label="Layers" className="flex flex-col">
            {visibleRows.map((row) => (
              <LayerRow
                key={row.id}
                row={row}
                depth={
                  row.id === activeId && projection
                    ? projection.depth
                    : row.depth
                }
                invalid={row.id === activeId && !canDrop}
                onSelect={(r) => write(r, { selected: true })}
                onHover={(r, hovered) => write(r, { hovered })}
                onToggleOpen={(r) => write(r, { open: !r.open })}
                onToggleVisible={toggleVisible}
                onToggleLocked={(r) => write(r, { locked: !r.locked })}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </SidebarContent>
  )
}

function EmptyState() {
  return (
    <SidebarContent className="items-center justify-center px-6 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Layers className="size-5" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Layers</p>
          <p className="text-xs text-muted-foreground">
            The page has no content yet. Add a block to see its component tree.
          </p>
        </div>
      </div>
    </SidebarContent>
  )
}
