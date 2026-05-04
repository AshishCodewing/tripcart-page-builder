"use client"

import {
  ChevronRight,
  CaseSensitive,
  PaintbrushVertical,
  PanelsTopLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarContent } from "@/components/ui/sidebar"
import { useLeftPanel } from "./left-panel-context"

export default function ThemePanel() {
  const { activeMode, togglePanel } = useLeftPanel()

  return (
    <SidebarContent>
      <div className="space-y-4 p-2">
        <div className="w-full">
          <Button
            className="flex w-full items-center justify-between"
            variant="ghost"
            onClick={() => togglePanel("presets")}
          >
            Browser Styles
            <ChevronRight />
          </Button>
        </div>
        <div className="space-y-1">
          <Button
            className="flex w-full items-center justify-start gap-2"
            variant="ghost"
            onClick={() => togglePanel("typography")}
          >
            <CaseSensitive />
            Typography
          </Button>
          <Button
            className="flex w-full items-center justify-start gap-2"
            variant="ghost"
            onClick={() => togglePanel("colors")}
          >
            <PaintbrushVertical />
            Colors
          </Button>
          <Button
            className="flex w-full items-center justify-start gap-2"
            variant="ghost"
            onClick={() => togglePanel("layout")}
          >
            <PanelsTopLeft />
            Layout
          </Button>
        </div>
      </div>
    </SidebarContent>
  )
}
