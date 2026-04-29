import { draftMode } from "next/headers"
import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"

// Preview-only single post. Public rendering happens elsewhere.
export default async function BlogPostPreview({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { isEnabled: isDraft } = await draftMode()
  if (!isDraft) notFound()

  const { slug } = await params
  const post = await prisma.post.findUnique({
    where: { slug },
    include: {
      categories: { select: { name: true, slug: true } },
      tags: { select: { name: true, slug: true } },
    },
  })
  if (!post) notFound()

  return (
    <article className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">{post.title}</h1>
        {post.publishedAt && (
          <div className="mt-1 text-sm text-muted-foreground">
            {post.publishedAt.toLocaleDateString()}
          </div>
        )}
      </header>
      <style dangerouslySetInnerHTML={{ __html: post.css }} />
      <div dangerouslySetInnerHTML={{ __html: post.html }} />
    </article>
  )
}
