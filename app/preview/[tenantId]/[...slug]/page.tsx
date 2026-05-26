import { draftMode } from "next/headers"
import { notFound } from "next/navigation"

import { PagePreview } from "@/components/page-builder/page-preview"
import { patternComponents } from "@/lib/plugins/patterns"
import { prisma } from "@/lib/prisma"

// Preview-only catch-all. Public rendering of CMS pages happens in a
// separate deployment that consumes this DB; here we serve the current
// editor draft when draft mode is active, and 404 otherwise.
//
// Tenant resolution: read from the `[tenantId]` URL segment that
// `/api/preview` redirects through. The page lookup uses the per-tenant
// compound key `(tenantId, path)` so two tenants with the same `/about`
// resolve to the right draft.
//
// The tenant's brand theme is injected by `[tenantId]/layout.tsx`, not
// here — that layout reads the same param and emits the compiled theme
// CSS once for the whole preview subtree. This page only handles the
// per-page render.
//
// Rendering uses the React-renderer project module against the persisted
// project JSON so React-component patterns (e.g. <HeroSection/>) stay in
// React end-to-end.
export default async function PreviewCatchAllPage({
  params,
}: {
  params: Promise<{ tenantId: string; slug: string[] }>
}) {
  const { isEnabled: isDraft } = await draftMode()
  if (!isDraft) notFound()

  const { tenantId, slug } = await params
  const path = slug.join("/")
  const page = await prisma.page.findUnique({
    where: { tenantId_path: { tenantId, path } },
  })
  if (!page) notFound()

  return (
    <PagePreview
      projectData={page.data}
      config={{ components: patternComponents }}
    />
  )
}
