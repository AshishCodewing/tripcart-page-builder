"use client"

import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SidebarHeader } from "@/components/ui/sidebar"

import LeftRail from "./left-rail"
import { useLeftPanel } from "./left-panel-context"
import { LEFT_PANELS } from "./panels"

export default function LeftPanel() {
  const { mode, setOpen } = useLeftPanel()
  const active = LEFT_PANELS.find((p) => p.mode === mode) ?? LEFT_PANELS[0]
  const ActiveIcon = active.icon

  return (
    <div className="flex h-full w-full">
      <LeftRail />

      {/* Panel body — hidden (not unmounted) when the sidebar collapses to the
          icon rail, so panel state survives collapse/expand. */}
      <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
        <SidebarHeader className="h-12 flex-row items-center gap-2 border-b px-3 py-0">
          <ActiveIcon className="size-4 text-muted-foreground" />
          <span className="flex-1 truncate text-sm font-medium">
            {active.label}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close panel"
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
        </SidebarHeader>

        {/* Every panel stays mounted; only the active one is shown. Switching
            tabs never remounts a panel, so e.g. the assistant's Chat keeps its
            state. `@starting-style` still fires on the display swap, preserving
            the fade-in. */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          {LEFT_PANELS.map(({ mode: panelMode, Component }) => (
            <div
              key={panelMode}
              className={cn(
                "min-h-0 flex-1 flex-col opacity-100 transition-opacity duration-150 ease-out motion-reduce:transition-none starting:opacity-0",
                panelMode === mode ? "flex" : "hidden"
              )}
            >
              <Component />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
