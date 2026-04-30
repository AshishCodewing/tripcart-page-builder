"use client"

import {
  SubPanel,
  SubPanelBack,
  SubPanelDescription,
  SubPanelSection,
} from "./sub-panel"

export default function PresetsPanel() {
  return (
    <SubPanel>
      <SubPanelBack>Browser Styles</SubPanelBack>
      <SubPanelDescription>
        Choose a variation to change the look of the site.
      </SubPanelDescription>
      <SubPanelSection>
        <h2 className="text-muted-foreground text-xs font-semibold uppercase">
          Color Palettes
        </h2>
        <div className="grid grid-cols-2" />
      </SubPanelSection>
    </SubPanel>
  )
}
