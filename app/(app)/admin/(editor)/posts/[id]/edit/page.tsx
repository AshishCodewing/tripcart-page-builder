import type { ProjectData } from "grapesjs"
import { notFound } from "next/navigation"

import EditorShell from "@/components/page-builder/editor-shell"
import { saveEditorDraft } from "@/lib/cms/editor-draft-actions"
import { deletePost, savePost } from "@/lib/cms/post-actions"
import { getPostById } from "@/lib/cms/posts"
import { listTemplates } from "@/lib/cms/templates"
import { getTenantTheme } from "@/lib/cms/tenants"

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getPostById(id)
  if (!post) notFound()

  const [tenantTheme, templates] = await Promise.all([
    getTenantTheme(post.tenantId),
    listTemplates(post.tenantId),
  ])
  const saveAction = savePost.bind(null, id)
  const deleteAction = deletePost.bind(null, id)
  const initialProjectData = (post.draftData ??
    post.data) as unknown as ProjectData
  const persistDraft = saveEditorDraft.bind(null, "post", id)

  return (
    <EditorShell
      content={{
        kind: "post",
        post: {
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          tenantId: post.tenantId,
          status: post.status,
          updatedAt: post.updatedAt,
        },
      }}
      tenantTheme={tenantTheme}
      initialProjectData={initialProjectData}
      persistDraft={persistDraft}
      saveAction={saveAction}
      deleteAction={deleteAction}
      templates={templates}
    />
  )
}
