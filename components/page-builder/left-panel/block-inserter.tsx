"use client"

import { Blocks } from "lucide-react"

import { SidebarContent } from "@/components/ui/sidebar"

export default function BlockInserter() {
  return (
    <SidebarContent className="items-center justify-center px-6 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Blocks className="size-5" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Block inserter</p>
          <p className="text-xs text-muted-foreground">
            Drag blocks onto the canvas. Coming soon.
          </p>
        </div>
      </div>
    </SidebarContent>
  )
}
