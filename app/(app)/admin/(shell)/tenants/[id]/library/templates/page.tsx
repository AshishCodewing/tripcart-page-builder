import { isDefaultShadowSlug, listTemplatesByKind } from "@/lib/cms/templates"
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
    // A LAYOUT at a hierarchy slug is a customized default ("shadow" → Reset to
    // default); any other LAYOUT is a user-created template ("user" → Delete).
    origin: isDefaultShadowSlug(t.kind, t.slug) ? "shadow" : "user",
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
      origin: "default",
    })
  }

  // Capabilities (edit / duplicate / reset-or-delete) are derived per row from
  // its origin by `resolveCapabilities`, so this page just lists the rows.
  return (
    <TemplatesDataTable
      items={[...items, ...synthetic]}
      emptyLabel="No templates yet."
      tenantId={id}
    />
  )
}
