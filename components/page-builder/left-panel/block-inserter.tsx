"use client"

import { BlocksProvider } from "@grapesjs/react"
import type { Block } from "grapesjs"

import { SidebarContent, SidebarHeader } from "@/components/ui/sidebar"
import {
  Tabs,
  TabsContent,
  TabsIndicator,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { isPatternBlock } from "@/lib/plugins/patterns"

import BlockManager from "./block-manager"

type CategoryMap = Map<string, Block[]>

const groupByCategory = (blocks: Block[]): CategoryMap => {
  const map: CategoryMap = new Map()
  for (const block of blocks) {
    const category = block.getCategoryLabel()
    const bucket = map.get(category)
    if (bucket) bucket.push(block)
    else map.set(category, [block])
  }
  return map
}

export default function BlockInserter() {
  return (
    <BlocksProvider>
      {({ blocks, dragStart, dragStop }) => {
        const patterns = blocks.filter(isPatternBlock)
        const standard = blocks.filter((b) => !isPatternBlock(b))

        return (
          <Tabs defaultValue="blocks" className="h-full min-h-0 gap-0">
            <SidebarHeader className="p-0">
              <TabsList variant="line" className="w-full justify-start">
                <TabsTrigger value="blocks">Blocks</TabsTrigger>
                <TabsTrigger value="patterns">Patterns</TabsTrigger>
                <TabsIndicator />
              </TabsList>
            </SidebarHeader>

            <TabsContent value="blocks" className="flex min-h-0 flex-col">
              <SidebarContent className="p-0">
                <BlockManager
                  mapCategoryBlocks={groupByCategory(standard)}
                  dragStart={dragStart}
                  dragStop={dragStop}
                />
              </SidebarContent>
            </TabsContent>

            <TabsContent value="patterns" className="flex min-h-0 flex-col">
              <SidebarContent className="p-0">
                <BlockManager
                  mapCategoryBlocks={groupByCategory(patterns)}
                  dragStart={dragStart}
                  dragStop={dragStop}
                />
              </SidebarContent>
            </TabsContent>
          </Tabs>
        )
      }}
    </BlocksProvider>
  )
}
