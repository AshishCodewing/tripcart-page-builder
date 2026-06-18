import { notFound } from "next/navigation"

import { PagePreview } from "@/components/page-builder/page-preview"
import { resolvePageTree } from "@/lib/cms/templates"
import type { ProjectDefinition } from "@/lib/plugins/react-renderer/project/types"
import { prisma } from "@/lib/prisma"

// Preview-only single post. Public rendering happens elsewhere.
//
// Tenant resolution: read from the `[tenantId]` URL segment that
// `/api/preview` redirects through. The post lookup uses the per-tenant
// compound key `(tenantId, slug)` so two tenants with the same
// `/blog/hello-world` resolve to the right draft.
//
// The tenant's brand theme is injected by `[tenantId]/layout.tsx`, not
// here — that layout reads the same param, emits the compiled theme CSS
// once for the whole preview subtree, and is the single draft-mode gate
// (so no draft check here).
//
// Same render path as pages: persisted project JSON (`post.data`) goes
// through the React-renderer project module so React-component patterns
// stay in React end-to-end.
export default async function BlogPostPreview({
  params,
}: {
  params: Promise<{ tenantId: string; slug: string }>
}) {
  const { tenantId, slug } = await params
  const post = await prisma.post.findUnique({
    where: { tenantId_slug: { tenantId, slug } },
    include: {
      categories: { select: { name: true, slug: true } },
      tags: { select: { name: true, slug: true } },
    },
  })
  if (!post) notFound()

  const projectData = await resolvePageTree(
    tenantId,
    post.data as ProjectDefinition
  )

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
      <PagePreview projectData={projectData} />
    </article>
  )
}
