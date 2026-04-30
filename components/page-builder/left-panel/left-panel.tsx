"use client"

import type { ComponentType } from "react"

import BlockInserter from "./block-inserter"
import LayersPanel from "./layers-panel"
import { useLeftPanel, type LeftPanelMode } from "./left-panel-context"
import ThemePanel from "./theme-panel"

const PANELS: Record<LeftPanelMode, ComponentType> = {
  blocks: BlockInserter,
  layers: LayersPanel,
  theme: ThemePanel,
}

export default function LeftPanel() {
  const { mode } = useLeftPanel()
  const Panel = PANELS[mode]
  return (
    <div
      key={mode}
      className="
        transition-opacity duration-150 ease-out
        opacity-100
        starting:opacity-0
        motion-reduce:transition-none
      "
    >
      <Panel />
    </div>
  )
}
