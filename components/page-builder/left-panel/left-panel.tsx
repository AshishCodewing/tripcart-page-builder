"use client"

import type { ComponentType } from "react"

import BlockInserter from "./block-inserter"
import LayersPanel from "./layers-panel"
import AssistantPanel from "./assistant-panel"
import { useLeftPanel, type LeftPanelMode } from "./left-panel-context"

const PANELS: Record<LeftPanelMode, ComponentType> = {
  blocks: BlockInserter,
  layers: LayersPanel,
  assistant: AssistantPanel,
}

export default function LeftPanel() {
  const { mode } = useLeftPanel()
  const Panel = PANELS[mode]
  return (
    <div
      key={mode}
      className="flex min-h-0 flex-1 flex-col opacity-100 transition-opacity duration-150 ease-out motion-reduce:transition-none starting:opacity-0"
    >
      <Panel />
    </div>
  )
}
