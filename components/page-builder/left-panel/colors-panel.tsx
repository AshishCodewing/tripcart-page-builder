"use client"

import { SidebarContent, SidebarHeader } from "@/components/ui/sidebar"
import { PanelBackButton } from "./panel-back-button"

export default function ColorsPanel() {
  return (
    <>
      <SidebarHeader>
        <PanelBackButton>Colors</PanelBackButton>
        <p className="my-2 px-2 text-xs text-balance">
          Palette colors and the application of those colors on site elements.
        </p>
      </SidebarHeader>
      <SidebarContent />
    </>
  )
}
