import { notFound } from "next/navigation"

import EditorShell from "@/components/page-builder/editor-shell"
import { deletePost, savePost } from "@/lib/cms/post-actions"
import { getPostById } from "@/lib/cms/posts"

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getPostById(id)
  if (!post) notFound()

  const saveAction = savePost.bind(null, id)
  const deleteAction = deletePost.bind(null, id)

  return (
    <EditorShell
      content={{
        kind: "post",
        post: {
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          status: post.status,
          updatedAt: post.updatedAt,
        },
      }}
      saveAction={saveAction}
      deleteAction={deleteAction}
    />
  )
}
