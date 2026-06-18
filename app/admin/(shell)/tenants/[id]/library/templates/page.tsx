import { listTemplatesByKind } from "@/lib/cms/templates"
import { TEMPLATE_HIERARCHY } from "@/lib/cms/template-hierarchy"
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
    description: t.description,
    kind: t.kind,
    area: t.area,
    synced: t.synced,
    tenantId: t.tenantId,
    preview: t.preview,
    updatedAt: t.updatedAt,
  }))

  // List every hierarchy type that isn't authored yet as a "Default"
  // placeholder. Skip any slug already backed by a real LAYOUT row so we never
  // shadow an authored template. Editing one materializes a tenant LAYOUT at
  // the slug (the WP transparent-shadow model — see `customizeDefaultLayout`).
  const synthetic: TemplateRow[] = []
  for (const { slug, title, description } of TEMPLATE_HIERARCHY) {
    if (rows.some((r) => r.slug === slug)) continue
    synthetic.push({
      id: `default:${slug}`,
      title,
      slug,
      description,
      kind: "LAYOUT",
      area: null,
      synced: false,
      tenantId: id,
      preview: null,
      updatedAt: null,
      // Editable (materializes a tenant LAYOUT), but not duplicable/deletable.
      isDefault: true,
    })
  }

  // Templates are edit + add only — no duplicate, no delete (a built-in row
  // edits into a tenant template; reverting is a future "clear customizations").
  return (
    <TemplatesDataTable
      items={[...items, ...synthetic]}
      emptyLabel="No templates yet."
      tenantId={id}
      canDuplicate={false}
      canDelete={false}
    />
  )
}
