"use client"

import { BlocksProvider } from "@grapesjs/react"
import type { Block, Component, Editor } from "grapesjs"
import {
  ArrowDownToLine,
  ArrowUpToLine,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  Plus,
} from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type Props = {
  editor: Editor
  selected: Component
}

// Where a chosen block lands relative to the selected component. GrapesJS has
// no dedicated "insert relative to" API — each position is expressed through
// `append(content, { at })` on either the parent (siblings) or the selected
// component itself (children).
type Position = "before" | "inside-first" | "inside-last" | "after"

// `kind` decides when an option is offered: `sibling` positions need a parent
// to sit next to (the wrapper/Body has none), `nesting` positions need a
// component that can hold children (a leaf like text can't).
const POSITIONS: {
  value: Position
  label: string
  icon: typeof Plus
  kind: "sibling" | "nesting"
}[] = [
  {
    value: "before",
    label: "Insert before",
    icon: ArrowUpToLine,
    kind: "sibling",
  },
  {
    value: "inside-first",
    label: "Insert as first child",
    icon: BetweenHorizontalStart,
    kind: "nesting",
  },
  {
    value: "inside-last",
    label: "Insert as last child",
    icon: BetweenHorizontalEnd,
    kind: "nesting",
  },
  {
    value: "after",
    label: "Insert after",
    icon: ArrowDownToLine,
    kind: "sibling",
  },
]

// Cap the grid so the picker stays compact; search narrows the full set down.
const MAX_BLOCKS = 6

// The "+" button shown at the corner of the selected component. Opens a block
// picker with a position toggle (before / inside / after) and a search box.
export function InsertBlockPicker({ editor, selected }: Props) {
  // `droppable === false` marks a leaf (text, image, …) that can't hold
  // children; a component with no parent (the wrapper/Body) has no siblings.
  const canNest = selected.get("droppable") !== false
  const canSibling = !!selected.parent()
  const available = POSITIONS.filter((p) =>
    p.kind === "nesting" ? canNest : canSibling
  )

  const [open, setOpen] = useState(false)
  // Default to the last available option ("after" for siblings-capable
  // components, otherwise "insert as last child" for the Body).
  const [position, setPosition] = useState<Position>(
    available.at(-1)?.value ?? "inside-last"
  )
  const [query, setQuery] = useState("")

  const insert = (block: Block) => {
    const content = block.get("content") as Parameters<Component["append"]>[0]

    editor.UndoManager.start()
    let added: ReturnType<Component["append"]>
    switch (position) {
      case "inside-first":
        added = selected.append(content, { at: 0 })
        break
      case "inside-last":
        added = selected.append(content)
        break
      case "before":
      case "after": {
        const parent = selected.parent()
        if (!parent) {
          editor.UndoManager.stop()
          return
        }
        const at = selected.index() + (position === "after" ? 1 : 0)
        added = parent.append(content, { at })
        break
      }
    }
    editor.UndoManager.stop()

    const first = Array.isArray(added) ? added[0] : added
    if (first) editor.select(first)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider delay={300}>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <Button
                    size="icon-xs"
                    className="pointer-events-auto rounded-full border-0 bg-primary text-white shadow-md hover:bg-primary/80 dark:bg-primary dark:hover:bg-primary/80"
                    aria-label="Add block"
                  >
                    <Plus />
                  </Button>
                }
              />
            }
          />
          <TooltipContent>Add Block</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="end" side="bottom" className="w-72 gap-0 p-0">
        <TooltipProvider delay={300}>
          <div className="flex flex-col gap-2 border-b p-2">
            {available.length > 1 && (
              <ToggleGroup
                variant="outline"
                value={[position]}
                onValueChange={(values: string[]) => {
                  const next = values[0] as Position | undefined
                  if (next) setPosition(next)
                }}
                aria-label="Insertion position"
                className="w-full"
              >
                {available.map(({ value, label, icon: Icon }) => (
                  <Tooltip key={value}>
                    <TooltipTrigger
                      render={
                        <ToggleGroupItem
                          value={value}
                          aria-label={label}
                          className="h-8 flex-1 px-0"
                        >
                          <Icon className="size-3.5" aria-hidden="true" />
                        </ToggleGroupItem>
                      }
                    />
                    <TooltipContent>{label}</TooltipContent>
                  </Tooltip>
                ))}
              </ToggleGroup>
            )}
            <Input
              inputSize="sm"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        </TooltipProvider>
        <BlocksProvider>
          {({ blocks }) => {
            const matches = filterBlocks(blocks, query)
            if (matches.length === 0) {
              return (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No blocks found.
                </p>
              )
            }
            return (
              <div className="grid grid-cols-2 gap-2 p-2">
                {matches.map((block) => (
                  <Button
                    key={block.getId()}
                    variant="outline"
                    title={block.getLabel()}
                    onClick={() => insert(block)}
                    className="flex h-auto cursor-pointer flex-col items-center gap-1.5 px-2 py-3 whitespace-normal"
                  >
                    <span
                      aria-hidden
                      className="flex size-10 items-center justify-center text-muted-foreground [&>svg]:size-8!"
                      dangerouslySetInnerHTML={{
                        __html: block.getMedia() ?? "",
                      }}
                    />
                    <span className="line-clamp-1 max-w-full text-xs font-normal">
                      {block.getLabel()}
                    </span>
                  </Button>
                ))}
              </div>
            )
          }}
        </BlocksProvider>
      </PopoverContent>
    </Popover>
  )
}

// Filter blocks by label against the query, then cap at MAX_BLOCKS.
const filterBlocks = (blocks: Block[], query: string): Block[] => {
  const q = query.trim().toLowerCase()
  const matched = q
    ? blocks.filter((b) => (b.getLabel() ?? "").toLowerCase().includes(q))
    : blocks
  return matched.slice(0, MAX_BLOCKS)
}
