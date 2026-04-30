"use client"

import {
  SubPanel,
  SubPanelBack,
  SubPanelDescription,
} from "./sub-panel"

export default function ColorsPanel() {
  return (
    <SubPanel>
      <SubPanelBack>Colors</SubPanelBack>
      <SubPanelDescription>
        Palette colors and the application of those colors on site elements.
      </SubPanelDescription>
    </SubPanel>
  )
}
