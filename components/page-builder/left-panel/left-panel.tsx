"use client"

import type { ComponentType } from "react"

import BlockInserter from "./block-inserter"
import LayersPanel from "./layers-panel"
import PresetsPanel from "./presets-panel"
import TypographyPanel from "./typography-panel"
import ColorsPanel from "./colors-panel"
import LayoutPanel from "./layout-panel"
import { useLeftPanel, type LeftPanelMode } from "./left-panel-context"
import ThemePanel from "./theme-panel"

const PANELS: Record<LeftPanelMode, ComponentType> = {
  blocks: BlockInserter,
  layers: LayersPanel,
  theme: ThemePanel,
  presets: PresetsPanel,
  typography: TypographyPanel,
  colors: ColorsPanel,
  layout: LayoutPanel
}

export default function LeftPanel() {
  const { mode } = useLeftPanel()
  const Panel = PANELS[mode]
  return (
    <div
      key={mode}
      className="opacity-100 transition-opacity duration-150 ease-out motion-reduce:transition-none starting:opacity-0"
    >
      <Panel />
    </div>
  )
}
