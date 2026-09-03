import { asc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { tenants } from "@/lib/schema"
import { mergeThemeOverDefaults } from "@/lib/theme/merge-defaults"
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
 * Resolve the active `Theme` document for a tenant, or `null` when the
 * tenant does not exist.
 *
 * The stored row is a set of overrides layered over the bundled
 * `defaultTheme` (`mergeThemeOverDefaults`), so a default added after the
 * tenant last saved — a new element style or `variations` entry — still
 * reaches them. `{}` / null (the "no overrides yet" sentinel) therefore
 * yields the defaults unchanged. A populated row is trusted (Zod-validated
 * on write by `updateTenantTheme`), so we cast rather than re-parse.
 */
export async function findTenantTheme(tenantId: string): Promise<Theme | null> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { theme: true },
  })
  if (!tenant) return null

  return mergeThemeOverDefaults((tenant.theme ?? {}) as unknown as Theme)
}

/** `findTenantTheme` for callers where a missing tenant is an error. */
export async function getTenantTheme(tenantId: string): Promise<Theme> {
  const theme = await findTenantTheme(tenantId)
  if (!theme) throw new Error(`Tenant ${tenantId} not found.`)
  return theme
}
