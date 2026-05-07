"use client"

import * as React from "react"
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
import TraitSettings from "./trait-settings"

export default function BlockSettings() {
  return (
    <Tabs defaultValue="style" className="h-full min-h-0 gap-0">
      <SidebarHeader className="p-3 pb-0">
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
        className="flex min-h-0 flex-col opacity-100 transition-opacity duration-150 ease-out motion-reduce:transition-none starting:opacity-0"
      >
        <SidebarContent className="p-3">
          <div className="space-y-2">
            <SelectorManager />
            <StyleManager />
          </div>
        </SidebarContent>
      </TabsContent>
      <TabsContent
        value="traits"
        className="flex min-h-0 flex-col opacity-100 transition-opacity duration-150 ease-out motion-reduce:transition-none starting:opacity-0"
      >
        <SidebarContent className="p-3">
          <TraitSettings />
        </SidebarContent>
      </TabsContent>
    </Tabs>
  )
}
