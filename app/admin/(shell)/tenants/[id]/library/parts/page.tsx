import { isDefaultShadowSlug, listTemplatesByKind } from "@/lib/cms/templates"
import { TemplatesDataTable, type TemplateRow } from "../templates-data-table"

export default async function LibraryPartsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const rows = await listTemplatesByKind(id, "PART")
  const items: TemplateRow[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    slug: t.slug,
    kind: t.kind,
    area: t.area,
    synced: t.synced,
    tenantId: t.tenantId,
    preview: t.preview,
    updatedAt: t.updatedAt,
    // A DB row at a reserved chrome slug is a customized default ("shadow"):
    // its destructive action is "Reset to default" rather than delete.
    origin: isDefaultShadowSlug(t.kind, t.slug) ? "shadow" : "user",
  }))

  // Transparent-shadow model (WP): always list the default Header/Footer.
  // When no tenant PART shadows the reserved slug, show a synthetic row
  // seeded from the code default — "Customize" materializes it (see
  // `customizeDefaultPart`).
  const synthetic: TemplateRow[] = []
  for (const slug of ["header", "footer"] as const) {
    if (rows.some((r) => r.slug === slug)) continue
    synthetic.push({
      id: `default:${slug}`,
      title: slug === "header" ? "Header" : "Footer",
      slug,
      kind: "PART",
      area: slug,
      synced: true,
      tenantId: id,
      preview: null,
      updatedAt: null,
      origin: "default",
    })
  }

  return (
    <TemplatesDataTable
      items={[...synthetic, ...items]}
      emptyLabel="No template parts yet."
      tenantId={id}
      showSynced={false}
    />
  )
}
