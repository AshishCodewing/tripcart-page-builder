"use client"

import {
  SubPanel,
  SubPanelBack,
  SubPanelDescription,
  SubPanelSection,
} from "./sub-panel"

export default function TypographyPanel() {
  return (
    <SubPanel>
      <SubPanelBack>Typography</SubPanelBack>
      <SubPanelDescription>
        Available fonts, typographic styles, and the application of those
        styles.
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
