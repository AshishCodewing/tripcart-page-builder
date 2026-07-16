import { notFound, redirect } from "next/navigation"

import { getTemplateIdBySlug } from "@/lib/cms/templates"

/**
 * Slug → id resolver for the template-ref "Edit" toolbar action.
 *
 * The `template-ref` component emits an edit event with the ref's slug
 * (not its id), since the slug is what's stored in `Page.data`. The
 * editor shell routes here, this server component does the lookup, and
 * we `redirect` to the canonical `/admin/templates/[id]/edit` route.
 *
 * `tenantId` segment may be the literal "global" to resolve against
 * the global library (tenantId IS NULL). For tenant-scoped lookups we
 * pass the actual tenant id and let `getTemplateIdBySlug` apply the
 * tenant-first / global-fallback shadowing rule.
 */
export default async function TemplateBySlugPage({
  params,
}: {
  params: Promise<{ tenantId: string; slug: string }>
}) {
  const { tenantId, slug } = await params
  // The "global" segment is the sentinel for globals-only lookup
  // (tenantId IS NULL). Anything else is treated as a real tenant id
  // and the lookup applies the tenant-first / global-fallback rule.
  const lookupTenantId = tenantId === "global" ? null : tenantId
  const id = await getTemplateIdBySlug(lookupTenantId, slug)
  if (!id) notFound()
  redirect(`/admin/templates/${id}/edit`)
}
