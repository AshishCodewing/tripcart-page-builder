"use client"

import type { ComponentType } from "react"
import { Layers, Plus, Sparkles, type LucideIcon } from "lucide-react"

import BlockInserter from "./block-inserter"
import LayersPanel from "./layers-panel"
import AssistantPanel from "./assistant-panel"
import type { LeftPanelMode } from "./left-panel-context"

export type LeftPanelDef = {
  mode: LeftPanelMode
  /** Shown in the panel header and the rail tooltip / aria-label. */
  label: string
  icon: LucideIcon
  Component: ComponentType
}

/**
 * Single source of truth for the left region: the rail renders one icon per
 * entry and the panel body renders every `Component` (kept mounted, visibility
 * toggled) so switching tabs never unmounts a panel — the assistant's Chat
 * state must survive tab switches.
 */
export const LEFT_PANELS: LeftPanelDef[] = [
  {
    mode: "blocks",
    label: "Insert Block",
    icon: Plus,
    Component: BlockInserter,
  },
  { mode: "layers", label: "Layers", icon: Layers, Component: LayersPanel },
  {
    mode: "assistant",
    label: "AI Assistant",
    icon: Sparkles,
    Component: AssistantPanel,
  },
]
