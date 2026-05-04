"use client"

import * as React from "react"
import type { BlocksResultProps } from "@grapesjs/react"
import { Blocks } from "lucide-react"
import { useEditor } from "@grapesjs/react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

type Props = Pick<
  BlocksResultProps,
  "mapCategoryBlocks" | "dragStart" | "dragStop"
>

export default function BlockManager({
  mapCategoryBlocks,
  dragStart,
  dragStop,
}: Props) {
  const categories = React.useMemo(
    () => Array.from(mapCategoryBlocks),
    [mapCategoryBlocks]
  )
  const editor = useEditor()

  if (categories.length === 0) return <BlockManagerEmpty />

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col">
        {categories.map(([category, blocks]) => (
          <section key={category || "uncategorized"}>
            <header className="border-y bg-muted/40 px-3 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {category || "Other"}
            </header>
            <div className="grid grid-cols-2 gap-2 p-3">
              {blocks.map((block) => (
                <Button
                  key={block.getId()}
                  variant="outline"
                  draggable
                  title={block.getLabel()}
                  onClick={() => {
                    const target = editor.getSelected() ?? editor.getWrapper()
                    const content = block.getContent()
                    if (content) target?.append(content)
                  }}
                  onDragStart={(ev) => dragStart(block, ev.nativeEvent)}
                  onDragEnd={() => dragStop(false)}
                  className="flex h-auto cursor-grab flex-col items-center gap-1.5 px-2 py-3 whitespace-normal active:cursor-grabbing"
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
}

function BlockManagerEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Blocks className="size-5" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">No blocks registered</p>
        <p className="text-xs text-muted-foreground">
          Register blocks via the GrapesJS Block Manager to drag onto the
          canvas.
        </p>
      </div>
    </div>
  )
}
