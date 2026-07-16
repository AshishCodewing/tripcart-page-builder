import ColorPaletteGrid from "./color-palette-grid"

export default function TenantThemeColorsPage() {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase">
        Color Palettes
      </h2>
      <ColorPaletteGrid />
    </section>
  )
}
