"use client"

import { SidebarContent, SidebarHeader } from "@/components/ui/sidebar"
import { PanelBackButton } from "./panel-back-button"

export default function TypographyPanel() {
  return (
    <>
      <SidebarHeader>
        <PanelBackButton>Typography</PanelBackButton>
        <p className="my-2 px-2 text-xs text-balance">
          Available fonts, typographic styles, and the application of those
          styles.
        </p>
      </SidebarHeader>
      <SidebarContent>
        <div className="space-y-2 border-t px-2 py-2">
          <h2 className="my-2 text-xs font-semibold text-muted-foreground uppercase">
            Color Palettes
          </h2>
          <div className="grid grid-cols-2" />
        </div>
      </SidebarContent>
    </>
  )
}
