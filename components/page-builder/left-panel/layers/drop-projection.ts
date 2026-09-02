import { arrayMove } from "@dnd-kit/sortable"

/**
 * Where a dragged layer row would land, derived from the flat row list plus the
 * pointer's horizontal travel. Pure — no editor, no DOM — so the depth maths is
 * unit testable (drop-projection.test.ts).
 *
 * The result is expressed as "insert into `parentId`, before `beforeId`" rather
 * than as an index on purpose: a reference sibling survives the remove-then-add
 * that `Component.move()` performs, so move-layer.ts never has to reason about
 * whether an index is pre- or post-removal.
 */
export type ProjectionRow = {
  id: string
  depth: number
  /** `null` means the row is a direct child of the layer root. */
  parentId: string | null
}

export type Projection = {
  parentId: string | null
  depth: number
  /** Sibling to insert before; `null` appends to the end of the parent. */
  beforeId: string | null
}

type ProjectDropArgs = {
  /** Flat rows in visual order, with the dragged subtree already removed. */
  rows: ProjectionRow[]
  activeId: string
  overId: string
  /** Horizontal pointer travel since the drag started, in pixels. */
  dragOffsetLeft: number
  indentWidth: number
}

export function projectDrop({
  rows,
  activeId,
  overId,
  dragOffsetLeft,
  indentWidth,
}: ProjectDropArgs): Projection | null {
  const activeIndex = rows.findIndex((r) => r.id === activeId)
  const overIndex = rows.findIndex((r) => r.id === overId)
  if (activeIndex < 0 || overIndex < 0) return null

  const moved = arrayMove(rows, activeIndex, overIndex)
  const previous = moved[overIndex - 1]
  const next = moved[overIndex + 1]

  // One indent step of horizontal travel = one level. Clamped so the row can
  // never nest deeper than "first child of the row above", nor sit shallower
  // than the row below — either would orphan the rows around it.
  const dragDepth = Math.round(dragOffsetLeft / indentWidth)
  const maxDepth = previous ? previous.depth + 1 : 0
  const minDepth = next ? next.depth : 0
  const depth = Math.min(
    Math.max(rows[activeIndex].depth + dragDepth, minDepth),
    maxDepth
  )

  const parentId = resolveParentId(moved, overIndex, depth, previous)
  // `arrayMove` puts the dragged row at `overIndex`, so the first later row
  // sharing the projected parent is the sibling it lands in front of.
  const beforeId =
    moved.slice(overIndex + 1).find((r) => r.parentId === parentId)?.id ?? null

  return { parentId, depth, beforeId }
}

function resolveParentId(
  moved: ProjectionRow[],
  overIndex: number,
  depth: number,
  previous: ProjectionRow | undefined
): string | null {
  if (depth === 0 || !previous) return null
  if (depth > previous.depth) return previous.id
  if (depth === previous.depth) return previous.parentId

  // Shallower than the row above: the new parent is whichever ancestor last
  // appeared at this depth.
  for (let i = overIndex - 1; i >= 0; i--) {
    if (moved[i].depth === depth) return moved[i].parentId
  }
  return null
}

/**
 * Drop every row *under* the given one, keeping the row itself. Called on drag
 * start: a branch being dragged must not be its own drop target, and its
 * children would otherwise skew the depths the projection above reads. The row
 * itself stays because dnd-kit still needs it as a sortable item.
 */
export function excludeDescendants<T extends ProjectionRow>(
  rows: T[],
  id: string
): T[] {
  const dropped = new Set([id])
  return rows.filter((row) => {
    if (row.parentId !== null && dropped.has(row.parentId)) {
      dropped.add(row.id)
      return false
    }
    return true
  })
}
