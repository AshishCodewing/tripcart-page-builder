import { Suspense } from "react"

import { listTemplatesByKind } from "@/lib/cms/templates"
import { TemplateGrid, type TemplateCardItem } from "../template-grid"

export default async function LibraryPatternsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const rows = await listTemplatesByKind(id, "PATTERN")
  const items: TemplateCardItem[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    slug: t.slug,
    kind: t.kind,
    area: t.area,
    tenantId: t.tenantId,
    preview: t.preview,
    updatedAt: t.updatedAt,
  }))

  return (
    <Suspense fallback={null}>
      <TemplateGrid items={items} emptyLabel="No patterns yet." />
    </Suspense>
  )
}
