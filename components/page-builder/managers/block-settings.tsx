"use client"

import { Paintbrush, Settings } from "lucide-react"

import { SidebarContent, SidebarHeader } from "@/components/ui/sidebar"
import {
  Tabs,
  TabsContent,
  TabsIndicator,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import SelectorManager from "./selector-manager"
import StyleManager from "./style-manager"
import TraitManager from "./trait-manager"

export default function BlockSettings() {
  return (
    <Tabs defaultValue="style" className="h-full min-h-0 gap-0">
      <SidebarHeader className="p-2">
        <TabsList variant="fill" className="w-full justify-between">
          <TabsTrigger value="style" className="flex-1">
            <Paintbrush />
          </TabsTrigger>
          <TabsTrigger value="traits" className="flex-1">
            <Settings />
          </TabsTrigger>
          <TabsIndicator />
        </TabsList>
      </SidebarHeader>
      <TabsContent
        value="style"
        keepMounted
        className="flex min-h-0 flex-col opacity-100 transition-opacity duration-150 ease-out motion-reduce:transition-none starting:opacity-0"
      >
        <SidebarContent>
          <div className="space-y-2">
            <div className="p-2">
              <SelectorManager />
            </div>
            <StyleManager />
          </div>
        </SidebarContent>
      </TabsContent>
      <TabsContent
        value="traits"
        keepMounted
        className="flex min-h-0 flex-col opacity-100 transition-opacity duration-150 ease-out motion-reduce:transition-none starting:opacity-0"
      >
        <SidebarContent className="p-2">
          <TraitManager />
        </SidebarContent>
      </TabsContent>
    </Tabs>
  )
}
