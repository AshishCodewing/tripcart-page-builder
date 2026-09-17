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

import BlockHeader from "./block-header"
import SelectorManager from "./selector-manager"
import StyleManager from "./style-manager"
import TraitManager from "./trait-manager"

export default function BlockSettings() {
  const [tab, setTab] = React.useState("style")
  // Raw CSS view of the style target — kept across selections, like Studio's
  // `{}` toggle, so you can click through components while reading CSS.
  const [codeView, setCodeView] = React.useState(false)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <BlockHeader
        codeView={codeView}
        onCodeViewChange={(next) => {
          setCodeView(next)
          // The code view replaces the style fields, so bring it into view.
          if (next) setTab("style")
        }}
      />
      <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-0">
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
              <StyleManager codeView={codeView} />
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
    </div>
  )
}
