"use client"

import {
  SubPanel,
  SubPanelBack,
  SubPanelDescription,
} from "./sub-panel"

export default function LayoutPanel() {
  return (
    <SubPanel>
      <SubPanelBack>Layout</SubPanelBack>
      <SubPanelDescription>
        Set the width of the main content area.
      </SubPanelDescription>
    </SubPanel>
  )
}
