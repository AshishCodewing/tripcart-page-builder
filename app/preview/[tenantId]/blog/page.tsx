import Link from "next/link"
import { draftMode } from "next/headers"
import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"

// Preview-only blog index, scoped to the tenant from the URL. Public
// rendering happens elsewhere.
export default async function BlogIndexPreview({
  params,
}: {
  params: Promise<{ tenantId: string }>
}) {
  const { isEnabled: isDraft } = await draftMode()
  if (!isDraft) notFound()

  const { tenantId } = await params

  const posts = await prisma.post.findMany({
    where: { tenantId },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
    },
  })

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-8 text-3xl font-semibold">Blog (preview)</h1>
      {posts.length === 0 ? (
        <p className="text-muted-foreground">No posts yet.</p>
      ) : (
        <ul className="space-y-6">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/preview/${tenantId}/blog/${post.slug}`}
                className="text-xl font-medium hover:underline"
              >
                {post.title}
              </Link>
              <div className="text-sm text-muted-foreground">
                {post.status}
                {post.publishedAt &&
                  ` · ${post.publishedAt.toLocaleDateString()}`}
              </div>
              {post.excerpt && <p className="mt-1 text-sm">{post.excerpt}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
