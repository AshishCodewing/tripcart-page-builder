import { notFound } from "next/navigation"

import { PagePreview } from "@/components/page-builder/page-preview"
import { getPageByPath } from "@/lib/cms/pages"
import { resolvePageTree } from "@/lib/cms/templates"
import { patternComponents } from "@/lib/plugins/patterns"
import type { ProjectDefinition } from "@/lib/plugins/react-renderer/project/types"

// Preview render of a CMS Page. The page's hierarchical `path` is the
// catch-all slug (`/preview/<tenantId>/pages/<path>`), looked up via the
// per-tenant compound key `(tenantId, path)`.
//
// The page renders only its own content; the site header/footer chrome is
// rendered once in `[tenantId]/layout.tsx`. Draft mode + the theme link are
// also handled by that layout (it is the single draft gate), so neither is
// re-checked here. Public rendering happens in a separate deployment.
export default async function PagePreviewRoute({
  params,
}: {
  params: Promise<{ tenantId: string; slug: string[] }>
}) {
  const { tenantId, slug } = await params
  const page = await getPageByPath(tenantId, slug.join("/"))
  if (!page) notFound()

  const projectData = await resolvePageTree(
    tenantId,
    page.data as ProjectDefinition
  )

  return (
    <PagePreview
      projectData={projectData}
      config={{ components: patternComponents }}
      rootTag="main"
    />
  )
}
