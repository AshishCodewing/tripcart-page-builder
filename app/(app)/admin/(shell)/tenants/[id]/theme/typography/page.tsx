import TypographyGrid from "./typography-grid"

export default function TenantThemeTypographyPage() {
  return (
    <section className="mx-auto w-full max-w-4xl space-y-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase">
        Typography
      </h2>
      <TypographyGrid />
    </section>
  )
}
