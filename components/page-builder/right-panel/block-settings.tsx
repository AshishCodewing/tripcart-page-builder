"use client"

import * as React from "react"
import {
  Tabs,
  TabsContent,
  TabsIndicator,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Paintbrush, Settings } from 'lucide-react';
import StyleSettings from "./style-settings";
import TraitSettings from "./trait-settings";
import SelectorManager from "./selector-manager";
export default function BlockSettings() {
  return (
    <div className="p-3">
      <Tabs defaultValue="style">
        <TabsList variant="fill" className="w-full justify-between">
          <TabsTrigger value="style" className="flex-1"><Paintbrush /></TabsTrigger>
          <TabsTrigger value="traits" className="flex-1"><Settings /></TabsTrigger>
          <TabsIndicator />
        </TabsList>
        <TabsContent value="style" className="@apply opacity-100 transition-opacity duration-150 ease-out motion-reduce:transition-none starting:opacity-0">
          <div className="space-y-2">
            <SelectorManager />
            <StyleSettings />
          </div>
        </TabsContent>
        <TabsContent value="traits" className="@apply opacity-100 transition-opacity duration-150 ease-out motion-reduce:transition-none starting:opacity-0">
          <TraitSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}