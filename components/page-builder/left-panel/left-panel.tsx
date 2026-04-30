"use client"

import BlockInserter from "./block-inserter"
import LayersPanel from "./layers-panel"
import { useLeftPanel } from "./left-panel-context"

export default function LeftPanel() {
  const { mode } = useLeftPanel()
  return mode === "blocks" ? <BlockInserter /> : <LayersPanel />
}
