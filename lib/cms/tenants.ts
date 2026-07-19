import { asc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { tenants } from "@/lib/schema"
import { defaultTheme } from "@/lib/tokens"
import type { Theme } from "@/lib/theme/schema"

export async function listTenants() {
  return db.query.tenants.findMany({
    orderBy: [asc(tenants.name)],
    columns: {
      id: true,
      name: true,
      slug: true,
      domain: true,
      createdAt: true,
    },
  })
}

export async function getTenantById(id: string) {
  return db.query.tenants.findFirst({ where: eq(tenants.id, id) })
}

export async function getTenantBySlug(slug: string) {
  return db.query.tenants.findFirst({ where: eq(tenants.slug, slug) })
}

/**
 * Resolve the active `Theme` document for a tenant.
 *
 * The DB stores `{}` as the "no overrides yet" sentinel — in that case
 * we return the bundled `defaultTheme` so the editor and renderer get a
 * complete document. A populated row is trusted (Zod-validated on write
 * by `updateTenantTheme`), so we just cast on read.
 */
export async function getTenantTheme(tenantId: string): Promise<Theme> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { theme: true },
  })
  if (!tenant) throw new Error(`Tenant ${tenantId} not found.`)

  const stored = tenant.theme
  const isEmpty =
    stored == null ||
    (typeof stored === "object" && Object.keys(stored).length === 0)

  return isEmpty ? defaultTheme : (stored as unknown as Theme)
}
