"use client"

import BlockInserter from "./block-inserter"
import LayersPanel from "./layers-panel"

export type InserterMode = "blocks" | "layers"

type Props = {
  mode: InserterMode
}

export default function InserterSidebar({ mode }: Props) {
  return mode === "blocks" ? <BlockInserter /> : <LayersPanel />
}
