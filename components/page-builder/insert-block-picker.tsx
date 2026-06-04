"use client"

import { BlocksProvider } from "@grapesjs/react"
import type { Block, Component, Editor } from "grapesjs"
import { Plus } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

type Props = {
  editor: Editor
  selected: Component
}

const groupByCategory = (blocks: Block[]): Map<string, Block[]> => {
  const map = new Map<string, Block[]>()
  for (const block of blocks) {
    const category = block.getCategoryLabel() || "Other"
    const bucket = map.get(category)
    if (bucket) bucket.push(block)
    else map.set(category, [block])
  }
  return map
}

// The "+" button shown at the corner of the selected component. Opens a block
// picker; the chosen block is inserted as a sibling immediately after the
// selected component.
export function InsertBlockPicker({ editor, selected }: Props) {
  const [open, setOpen] = useState(false)

  const insertAfter = (block: Block) => {
    const parent = selected.parent()
    if (!parent) return
    const content = block.get("content") as Parameters<typeof parent.append>[0]
    const at = selected.index() + 1
    editor.UndoManager.start()
    const added = parent.append(content, { at })
    editor.UndoManager.stop()
    const first = Array.isArray(added) ? added[0] : added
    if (first) editor.select(first)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            size="icon-xs"
            className="pointer-events-auto rounded-full border-0 bg-primary text-white shadow-md hover:bg-primary/80 dark:bg-primary dark:hover:bg-primary/80"
            aria-label="Insert block after"
          >
            <Plus />
          </Button>
        }
      />
      <PopoverContent align="end" side="bottom" className="w-72 gap-0 p-0">
        <BlocksProvider>
          {({ blocks }) => {
            const categories = Array.from(groupByCategory(blocks))
            if (categories.length === 0) {
              return (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No blocks registered.
                </p>
              )
            }
            return (
              <ScrollArea className="max-h-80">
                <div className="flex flex-col">
                  {categories.map(([category, items]) => (
                    <section key={category}>
                      <header className="border-y bg-muted/40 px-3 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase first:border-t-0">
                        {category}
                      </header>
                      <div className="grid grid-cols-2 gap-2 p-2">
                        {items.map((block) => (
                          <Button
                            key={block.getId()}
                            variant="outline"
                            title={block.getLabel()}
                            onClick={() => insertAfter(block)}
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
                    </section>
                  ))}
                </div>
              </ScrollArea>
            )
          }}
        </BlocksProvider>
      </PopoverContent>
    </Popover>
  )
}
