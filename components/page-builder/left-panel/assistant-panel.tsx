"use client"

import { SidebarContent } from "@/components/ui/sidebar"
import Chat from "@/components/ai/chat"
export default function AssistantPanel() {
  return (
    <SidebarContent className="items-center justify-center">
      <Chat />
    </SidebarContent>
  )
}
