import { listTemplatesByKind } from "@/lib/cms/templates"
import { TemplatesDataTable, type TemplateRow } from "../templates-data-table"

export default async function LibraryTemplatesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const rows = await listTemplatesByKind(id, "LAYOUT")
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
  }))

  return <TemplatesDataTable items={items} emptyLabel="No templates yet." />
}
