import { and, eq, inArray, isNotNull, ne } from "drizzle-orm"

import { defaultFooter, defaultHeader } from "@/lib/plugins/parts"
import type { ProjectDefinition } from "@/lib/plugins/react-renderer/project/types"
import { db } from "@/lib/db"
import { chromeAssignments, templates, tenants } from "@/lib/schema"

import type { TemplateHierarchySlug } from "./template-hierarchy"
import { resolveChromeBySlug } from "./templates"

// Chrome is assigned per WP-style template-hierarchy slug (see
// `TEMPLATE_HIERARCHY`): a header/footer PART is "used on" one or more of
// those templates (`page`, `single`, `archive`, …). `ChromeAssignment.segment`
// stores the hierarchy slug; each preview route maps to one (see the segment
// layouts). The `index` slug is the WP catch-all fallback — an assignment
// there applies to any route without a more specific assignment.
const INDEX_HIERARCHY_SLUG = "index"

// Tenant-wide default chrome slugs — the fallback when neither the requested
// template nor `index` has an explicit assignment. These are the reserved
// slugs the pre-Piece-2 layout always resolved, so an unassigned template
// renders identically; they in turn fall back to the code-default part inside
// `resolveChromeBySlug`.
const DEFAULT_HEADER_SLUG = "header"
const DEFAULT_FOOTER_SLUG = "footer"

export async function getChromeAssignment(
  tenantId: string,
  segment: TemplateHierarchySlug
) {
  return db.query.chromeAssignments.findFirst({
    where: and(
      eq(chromeAssignments.tenantId, tenantId),
      eq(chromeAssignments.segment, segment)
    ),
    columns: { headerSlug: true, footerSlug: true },
  })
}

// The inverse of the resolver: the template-hierarchy slugs a given part is
// currently the chrome for. Seeds the Part editor's "Used on" multi-select so
// it opens pre-checked with the part's existing assignments. Matches the
// part's own slug against the header or footer column per its area.
export async function getPartChromeAssignments(
  tenantId: string,
  area: "header" | "footer",
  slug: string
): Promise<string[]> {
  const rows = await db.query.chromeAssignments.findMany({
    where: and(
      eq(chromeAssignments.tenantId, tenantId),
      area === "header"
        ? eq(chromeAssignments.headerSlug, slug)
        : eq(chromeAssignments.footerSlug, slug)
    ),
    columns: { segment: true },
  })
  return rows.map((r) => r.segment)
}

// The segments currently claimed by a *different* part in the same area, keyed
// to the owning part's title. Powers the "currently <title> — selecting moves
// it here" hint in the Part editor's "Used on" picker: a segment whose
// header/footer slot already points at another part is annotated, and picking
// it reassigns the slot (the `saveTemplate` upsert overwrites the column, so
// the old owner is dropped automatically — no extra write here). Excludes this
// part's own assignments, which `getPartChromeAssignments` already returns as
// the pre-checked chips.
export async function getSegmentsOwnedByOtherParts(
  tenantId: string,
  area: "header" | "footer",
  slug: string
): Promise<Record<string, string>> {
  const isHeader = area === "header"
  const ownerCol = isHeader
    ? chromeAssignments.headerSlug
    : chromeAssignments.footerSlug
  const rows = await db.query.chromeAssignments.findMany({
    where: and(
      eq(chromeAssignments.tenantId, tenantId),
      // Set (not null) and pointing at some *other* part's slug.
      isNotNull(ownerCol),
      ne(ownerCol, slug)
    ),
    columns: { segment: true, headerSlug: true, footerSlug: true },
  })
  if (rows.length === 0) return {}

  // Resolve each owning slug to its human title in one lookup.
  const ownerSlugs = [
    ...new Set(
      rows
        .map((r) => (isHeader ? r.headerSlug : r.footerSlug))
        .filter((s): s is string => s !== null)
    ),
  ]
  const owners = await db.query.templates.findMany({
    where: and(
      eq(templates.tenantId, tenantId),
      eq(templates.area, area),
      inArray(templates.slug, ownerSlugs)
    ),
    columns: { slug: true, title: true },
  })
  const titleBySlug = new Map(owners.map((o) => [o.slug, o.title]))

  const result: Record<string, string> = {}
  for (const row of rows) {
    const owner = isHeader ? row.headerSlug : row.footerSlug
    if (owner) result[row.segment] = titleBySlug.get(owner) ?? owner
  }
  return result
}

export type ResolvedChrome = {
  header: ProjectDefinition | null
  footer: ProjectDefinition | null
}

// Resolve the header + footer a given template-hierarchy slug should render,
// applying the assignment → `index` catch-all → tenant-default-slug →
// code-default fallback chain. The slug indirection means an assigned part
// inherits the same tenant-first / global shadowing chrome has always had
// (WP's by-slug part reference). A missing/deleted assigned part degrades
// gracefully to the code default.
export async function resolveSegmentChrome(
  tenantId: string,
  segment: TemplateHierarchySlug
): Promise<ResolvedChrome> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { name: true },
  })
  if (!tenant) return { header: null, footer: null }

  const direct = await getChromeAssignment(tenantId, segment)
  // `index` is the catch-all; skip the extra lookup when it *is* index.
  const fallback =
    segment === INDEX_HIERARCHY_SLUG
      ? null
      : await getChromeAssignment(tenantId, INDEX_HIERARCHY_SLUG)

  const headerSlug =
    direct?.headerSlug ?? fallback?.headerSlug ?? DEFAULT_HEADER_SLUG
  const footerSlug =
    direct?.footerSlug ?? fallback?.footerSlug ?? DEFAULT_FOOTER_SLUG

  const header =
    (await resolveChromeBySlug(tenantId, headerSlug)) ??
    defaultHeader(tenant.name)
  const footer =
    (await resolveChromeBySlug(tenantId, footerSlug)) ??
    defaultFooter(tenant.name)

  return { header, footer }
}
