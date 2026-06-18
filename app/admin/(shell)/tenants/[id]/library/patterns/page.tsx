import { listTemplatesByKind } from "@/lib/cms/templates"
import { BUILTIN_PATTERNS } from "@/lib/plugins/patterns/manifest"
import { TemplatesDataTable, type TemplateRow } from "../templates-data-table"

export default async function LibraryPatternsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Code-defined patterns (read-only "Built-in" rows) merged with the
  // tenant's DB patterns — the WordPress model (pattern registry + DB,
  // unioned at read time; code patterns never copied into the DB). See
  // `lib/plugins/patterns/manifest.ts`.
  const builtins: TemplateRow[] = BUILTIN_PATTERNS.map((p) => ({
    id: p.id,
    title: p.label,
    slug: p.id,
    kind: "PATTERN",
    area: null,
    synced: false,
    tenantId: null,
    preview: null,
    updatedAt: null,
    builtin: true,
  }))

  const rows = await listTemplatesByKind(id, "PATTERN")
  const dbItems: TemplateRow[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    slug: t.slug,
    kind: t.kind,
    area: t.area,
    synced: t.synced,
    tenantId: t.tenantId,
    preview: t.preview,
    updatedAt: t.updatedAt,
    builtin: false,
  }))

  return (
    <TemplatesDataTable
      items={[...dbItems, ...builtins]}
      emptyLabel="No patterns yet."
      tenantId={id}
    />
  )
}
