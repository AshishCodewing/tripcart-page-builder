"use client"

import { BlocksProvider } from "@grapesjs/react"
import { LayoutTemplate } from "lucide-react"

import { SidebarContent, SidebarHeader } from "@/components/ui/sidebar"
import {
  Tabs,
  TabsContent,
  TabsIndicator,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import BlockManager from "./block-manager"

export default function BlockInserter() {
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
          <BlocksProvider>
            {(props) => <BlockManager {...props} />}
          </BlocksProvider>
        </SidebarContent>
      </TabsContent>

      <TabsContent value="patterns" className="flex min-h-0 flex-col">
        <SidebarContent>
          <PatternsPlaceholder />
        </SidebarContent>
      </TabsContent>
    </Tabs>
  )
}

function PatternsPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <LayoutTemplate className="size-5" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Patterns</p>
        <p className="text-xs text-muted-foreground">
          Pre-built layouts and saved blocks. Coming soon.
        </p>
      </div>
    </div>
  )
}
