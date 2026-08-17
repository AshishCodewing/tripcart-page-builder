import type { ProjectData } from "grapesjs"
import { notFound } from "next/navigation"

import EditorShell from "@/components/page-builder/editor-shell"
import { saveEditorDraft } from "@/lib/cms/editor-draft-actions"
import { deletePage, savePage } from "@/lib/cms/page-actions"
import { getPageById, listPageParents } from "@/lib/cms/pages"
import { resolveLatestThreadId } from "@/lib/ai/conversations"
import { listTemplates } from "@/lib/cms/templates"
import { getTenantTheme } from "@/lib/cms/tenants"

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [page, parentOptions] = await Promise.all([
    getPageById(id),
    listPageParents(id),
  ])
  if (!page) notFound()

  const [tenantTheme, templates] = await Promise.all([
    getTenantTheme(page.tenantId),
    listTemplates(page.tenantId),
  ])
  const saveAction = savePage.bind(null, id)
  const deleteAction = deletePage.bind(null, id)
  // Seed the editor from the in-progress draft when present, else the
  // published content. Both are full ProjectDefinitions for pages.
  const initialProjectData = (page.draftData ??
    page.data) as unknown as ProjectData
  const persistDraft = saveEditorDraft.bind(null, "page", id)

  return (
    <EditorShell
      chatThreadId={await resolveLatestThreadId("page", id)}
      content={{ kind: "page", page, parentOptions }}
      tenantTheme={tenantTheme}
      initialProjectData={initialProjectData}
      persistDraft={persistDraft}
      saveAction={saveAction}
      deleteAction={deleteAction}
      templates={templates}
    />
  )
}
