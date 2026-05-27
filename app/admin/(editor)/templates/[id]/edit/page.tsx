import { notFound } from "next/navigation"

import EditorShell from "@/components/page-builder/editor-shell"
import type { TemplateRecord } from "@/components/page-builder/types"
import { getTemplateById } from "@/lib/cms/templates"
import { saveTemplate } from "@/lib/cms/template-actions"
import { getTenantTheme } from "@/lib/cms/tenants"
import { defaultTheme } from "@/lib/tokens"

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const tpl = await getTemplateById(id)
  if (!tpl) notFound()

  // Tenant-scoped templates inherit the owning tenant's theme. Globals
  // (tenantId IS NULL) have no owning tenant; fall back to the bundled
  // defaultTheme so the editor still renders with a complete document.
  const tenantTheme = tpl.tenantId
    ? await getTenantTheme(tpl.tenantId)
    : defaultTheme

  const record: TemplateRecord = {
    id: tpl.id,
    title: tpl.title,
    slug: tpl.slug,
    tenantId: tpl.tenantId,
    kind: tpl.kind,
    area: tpl.area,
    synced: tpl.synced,
    status: tpl.status,
    updatedAt: tpl.updatedAt,
  }

  const saveAction = saveTemplate.bind(null, id)
  // Delete isn't wired yet — pass a no-op so the right panel's delete
  // button doesn't fire arbitrary actions. A proper template delete
  // lands with the templates admin index.
  const deleteAction = async () => {
    "use server"
  }

  return (
    <EditorShell
      content={{ kind: "template", template: record }}
      tenantTheme={tenantTheme}
      saveAction={saveAction}
      deleteAction={deleteAction}
    />
  )
}
