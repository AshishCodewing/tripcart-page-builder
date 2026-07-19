// Slug helpers shared across the template server actions. Plain async
// functions (no "use server"); the actions own the boundary.

import { and, eq, isNull, ne } from "drizzle-orm"

import { db } from "@/lib/db"
import { templates } from "@/lib/schema"

import { validateSlug } from "../path"
import { templateRefUsage } from "../templates"
import { formatTemplateRefUsage } from "../template-ref-usage"

// Prisma's `{ tenantId }` filter means IS NULL when tenantId is null; Drizzle
// needs the null case spelled out.
const tenantScope = (tenantId: string | null) =>
  tenantId === null
    ? isNull(templates.tenantId)
    : eq(templates.tenantId, tenantId)

// Resolve slug collisions within a tenant scope by appending -2, -3, …
// Uses findFirst (not the compound unique key) so globals — where tenantId is
// null and SQL nulls aren't unique-comparable — dedupe correctly too.
export async function dedupeSlug(
  tenantId: string | null,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug
  let suffix = 2
  while (
    await db.query.templates.findFirst({
      where: and(tenantScope(tenantId), eq(templates.slug, slug)),
      columns: { id: true },
    })
  ) {
    slug = `${baseSlug}-${suffix}`
    suffix++
  }
  return slug
}

// Guard a slug rename (§4): the new slug must be valid and unique within the
// tenant scope, and the rename is forbidden while any template-ref still
// points at the old slug (renaming would silently break those refs). Throws
// with a user-facing message on conflict.
export async function assertSlugRenameable(
  id: string,
  newSlug: string,
  oldSlug: string,
  tenantId: string | null
): Promise<void> {
  validateSlug(newSlug)
  // Per-tenant slug uniqueness (globals share the null-tenant space).
  const clash = await db.query.templates.findFirst({
    where: and(
      tenantScope(tenantId),
      eq(templates.slug, newSlug),
      ne(templates.id, id)
    ),
    columns: { id: true },
  })
  if (clash) {
    throw new Error(`A template with slug "${newSlug}" already exists.`)
  }
  const usage = await templateRefUsage(oldSlug)
  if (usage.total > 0) {
    throw new Error(
      `Cannot rename "${oldSlug}" — it is referenced by ` +
        `${formatTemplateRefUsage(usage)}. Remove those references before ` +
        `renaming.`
    )
  }
}
