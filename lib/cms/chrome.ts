import { defaultFooter, defaultHeader } from "@/lib/plugins/parts"
import type { ProjectDefinition } from "@/lib/plugins/react-renderer/project/types"
import { prisma } from "@/lib/prisma"

import { resolveChromeBySlug } from "./templates"

// The fixed set of preview route segments a tenant can assign chrome to.
// App-owned (not a DB enum) so adding a segment is a one-line change here +
// a route layout, with no migration. Mirrors WP's template hierarchy
// endpoints, scoped to what this builder actually routes.
export const CHROME_SEGMENTS = [
  "home",
  "pages",
  "posts",
  "categories",
  "tags",
  "authors",
] as const

export type ChromeSegment = (typeof CHROME_SEGMENTS)[number]

export function isChromeSegment(value: string): value is ChromeSegment {
  return (CHROME_SEGMENTS as readonly string[]).includes(value)
}

// Tenant-wide default chrome slugs — the fallback when a segment has no
// explicit assignment. These are the reserved slugs the pre-Piece-2 layout
// always resolved, so an unassigned segment renders identically; they in
// turn fall back to the code-default part inside `resolveChromeBySlug`.
const DEFAULT_HEADER_SLUG = "header"
const DEFAULT_FOOTER_SLUG = "footer"

export async function getChromeAssignment(
  tenantId: string,
  segment: ChromeSegment
) {
  return prisma.chromeAssignment.findUnique({
    where: { tenantId_segment: { tenantId, segment } },
    select: { headerSlug: true, footerSlug: true },
  })
}

export type ResolvedChrome = {
  header: ProjectDefinition | null
  footer: ProjectDefinition | null
}

// Resolve the header + footer a given route segment should render, applying
// the assignment → tenant-default-slug → code-default fallback chain. The
// slug indirection means an assigned part inherits the same tenant-first /
// global shadowing chrome has always had (WP's by-slug part reference). A
// missing/deleted assigned part degrades gracefully to the code default.
export async function resolveSegmentChrome(
  tenantId: string,
  segment: ChromeSegment
): Promise<ResolvedChrome> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  })
  if (!tenant) return { header: null, footer: null }

  const assignment = await getChromeAssignment(tenantId, segment)
  const headerSlug = assignment?.headerSlug ?? DEFAULT_HEADER_SLUG
  const footerSlug = assignment?.footerSlug ?? DEFAULT_FOOTER_SLUG

  const header =
    (await resolveChromeBySlug(tenantId, headerSlug)) ??
    defaultHeader(tenant.name)
  const footer =
    (await resolveChromeBySlug(tenantId, footerSlug)) ??
    defaultFooter(tenant.name)

  return { header, footer }
}
