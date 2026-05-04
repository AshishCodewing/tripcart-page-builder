"use client"

import { SidebarContent, SidebarHeader } from "@/components/ui/sidebar"
import { PanelBackButton } from "./panel-back-button"

export default function LayoutPanel() {
  return (
    <>
      <SidebarHeader>
        <PanelBackButton>Layout</PanelBackButton>
        <p className="my-2 px-2 text-xs text-balance">
          Set the width of the main content area.
        </p>
      </SidebarHeader>
      <SidebarContent />
    </>
  )
}
