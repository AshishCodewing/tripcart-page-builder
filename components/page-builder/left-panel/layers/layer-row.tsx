"use client"

import type { CSSProperties, PointerEvent, ReactNode } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronRight, Eye, EyeOff, Lock, LockOpen } from "lucide-react"

import { cn } from "@/lib/utils"

import type { LayerRow as Row } from "./use-layer-tree"

export const INDENT_WIDTH = 14

type LayerRowProps = {
  row: Row
  /** Render depth — the *projected* depth while this row is being dragged. */
  depth: number
  /** True when the current drop target would be rejected by `canMove`. */
  invalid: boolean
  onSelect: (row: Row) => void
  onHover: (row: Row, hovered: boolean) => void
  onToggleOpen: (row: Row) => void
  onToggleVisible: (row: Row) => void
  onToggleLocked: (row: Row) => void
}

export default function LayerRow({
  row,
  depth,
  invalid,
  onSelect,
  onHover,
  onToggleOpen,
  onToggleVisible,
  onToggleLocked,
}: LayerRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id, disabled: row.locked })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingInlineStart: depth * INDENT_WIDTH,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Spread first: dnd-kit's `attributes` carries `role="button"`, and a row
      // in a tree is a treeitem.
      {...attributes}
      {...listeners}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={row.selected}
      aria-expanded={row.hasChildren ? row.open : undefined}
      data-selected={row.selected || undefined}
      data-dragging={isDragging || undefined}
      data-invalid={(isDragging && invalid) || undefined}
      className={cn(
        "group/layer flex h-7 items-center gap-0.5 rounded-sm pe-1 text-xs transition-colors motion-reduce:transition-none",
        row.selected
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50",
        !row.visible && "opacity-50",
        isDragging && "z-10 bg-background shadow-sm ring-1 ring-border",
        isDragging && invalid && "ring-destructive"
      )}
      onClick={() => onSelect(row)}
      onPointerEnter={() => onHover(row, true)}
      onPointerLeave={() => onHover(row, false)}
    >
      {row.hasChildren ? (
        <IconButton
          label={row.open ? "Collapse layer" : "Expand layer"}
          active
          onClick={() => onToggleOpen(row)}
        >
          <ChevronRight
            className={cn(
              "size-3 transition-transform motion-reduce:transition-none",
              row.open && "rotate-90"
            )}
          />
        </IconButton>
      ) : (
        <span className="size-5 shrink-0" />
      )}

      <span className="min-w-0 flex-1 truncate text-start">{row.name}</span>

      <IconButton
        label={row.visible ? "Hide layer" : "Show layer"}
        active={!row.visible}
        onClick={() => onToggleVisible(row)}
      >
        {row.visible ? (
          <Eye className="size-3" />
        ) : (
          <EyeOff className="size-3" />
        )}
      </IconButton>

      <IconButton
        label={row.locked ? "Unlock layer" : "Lock layer"}
        active={row.locked}
        onClick={() => onToggleLocked(row)}
      >
        {row.locked ? (
          <Lock className="size-3" />
        ) : (
          <LockOpen className="size-3" />
        )}
      </IconButton>
    </div>
  )
}

type IconButtonProps = {
  label: string
  /** Keeps the control visible when its state is the non-default one. */
  active?: boolean
  onClick: () => void
  children: ReactNode
}

/**
 * `stopPropagation` on both handlers: the whole row is the drag handle and the
 * click target, so a control inside it has to opt out of each.
 */
function IconButton({ label, active, onClick, children }: IconButtonProps) {
  const stop = (e: PointerEvent) => e.stopPropagation()

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "opacity-100" : "opacity-0 group-hover/layer:opacity-60"
      )}
      onPointerDown={stop}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}
