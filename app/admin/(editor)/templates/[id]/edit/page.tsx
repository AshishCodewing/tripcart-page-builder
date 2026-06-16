import type { ProjectData } from "grapesjs"
import { notFound } from "next/navigation"

import EditorShell from "@/components/page-builder/editor-shell"
import type { TemplateRecord } from "@/components/page-builder/types"
import { saveEditorDraft } from "@/lib/cms/editor-draft-actions"
import {
  getTemplateById,
  listTemplates,
  templateRefUsage,
  type TemplateBody,
} from "@/lib/cms/templates"
import { deleteTemplate, saveTemplate } from "@/lib/cms/template-actions"
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
  // Template blocks aren't surfaced when editing a global template
  // (no tenant context for `listTemplates`); resolve that case later
  // by exposing the global library as a separate block source.
  const [tenantTheme, allTemplates, refUsage] = await Promise.all([
    tpl.tenantId ? getTenantTheme(tpl.tenantId) : Promise.resolve(defaultTheme),
    tpl.tenantId ? listTemplates(tpl.tenantId) : Promise.resolve([]),
    templateRefUsage(tpl.slug),
  ])
  // Don't expose the template currently being edited as a draggable
  // block — dragging self would create a recursive `template-ref`
  // that the resolver handles via its cycle guard, but the UX would
  // just confuse users.
  const templates = allTemplates.filter((t) => t.id !== tpl.id)

  const record: TemplateRecord = {
    id: tpl.id,
    title: tpl.title,
    slug: tpl.slug,
    tenantId: tpl.tenantId,
    kind: tpl.kind,
    area: tpl.area,
    synced: tpl.synced,
    updatedAt: tpl.updatedAt,
    refUsage,
  }

  const saveAction = saveTemplate.bind(null, id)
  const deleteAction = deleteTemplate.bind(null, id)

  // Wrap the slim Template body (`{ component, styles }`, §9) back into
  // the full project shape GrapesJS expects — the editor IO boundary.
  // Prefer the in-progress draft over the published body. A brand-new
  // template (`data === {}`) yields an empty project → blank canvas.
  const body = (tpl.draftData ?? tpl.data) as TemplateBody
  const initialProjectData = (body.component !== undefined
    ? {
        pages: [{ frames: [{ component: body.component }] }],
        styles: body.styles ?? [],
      }
    : body.pages
      ? { pages: body.pages, styles: body.styles ?? [] }
      : {}) as unknown as ProjectData
  const persistDraft = saveEditorDraft.bind(null, "template", id)

  return (
    <EditorShell
      content={{ kind: "template", template: record }}
      tenantTheme={tenantTheme}
      initialProjectData={initialProjectData}
      persistDraft={persistDraft}
      saveAction={saveAction}
      deleteAction={deleteAction}
      templates={templates}
    />
  )
}
