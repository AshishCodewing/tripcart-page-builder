import { notFound } from "next/navigation"

import EditorShell from "@/components/page-builder/editor-shell"
import { deletePage, savePage } from "@/lib/cms/page-actions"
import { getPageById, listPageParents } from "@/lib/cms/pages"

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

  const saveAction = savePage.bind(null, id)
  const deleteAction = deletePage.bind(null, id)

  return (
    <EditorShell
      content={{ kind: "page", page, parentOptions }}
      saveAction={saveAction}
      deleteAction={deleteAction}
    />
  )
}
