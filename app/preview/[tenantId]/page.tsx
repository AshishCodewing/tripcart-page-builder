import { notFound } from "next/navigation"

import { PagePreview } from "@/components/page-builder/page-preview"
import { getPageByPath } from "@/lib/cms/pages"
import { resolvePageTree } from "@/lib/cms/templates"
import { patternComponents } from "@/lib/plugins/patterns"
import type { ProjectDefinition } from "@/lib/plugins/react-renderer/project/types"

// Tenant home / front page (`/preview/<tenantId>`). The front page is the
// Page at the reserved path "home" (one per tenant — see lib/cms/path.ts);
// other pages live under /pages/<path>. Same render contract as the page
// route: content only, wrapped in the site chrome by `[tenantId]/layout.tsx`,
// which also owns the draft gate + theme link.
export default async function TenantHomePreview({
  params,
}: {
  params: Promise<{ tenantId: string }>
}) {
  const { tenantId } = await params
  const page = await getPageByPath(tenantId, "home")
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
