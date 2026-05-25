import { cookies } from "next/headers"

import { prisma } from "@/lib/prisma"
import { defaultTheme } from "@/lib/tokens"
import type { Theme } from "@/lib/theme/schema"

/**
 * Cookie set by `/api/preview` to pin the preview session to a single
 * tenant. Read by the preview catch-all routes (which only run with
 * draft mode on) to resolve `Page.path` / `Post.slug` against the right
 * tenant. Cleared by `/api/preview/exit` alongside draft mode.
 *
 * The public renderer (separate deployment) should NOT use this cookie
 * — it resolves tenant from request host instead.
 */
export const PREVIEW_TENANT_COOKIE = "tc-preview-tenant"

/**
 * Read the preview tenant cookie and verify the tenant still exists.
 * Returns null when the cookie is absent or points at a deleted tenant.
 */
export async function getPreviewTenantId(): Promise<string | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(PREVIEW_TENANT_COOKIE)?.value
  if (!value) return null
  const tenant = await prisma.tenant.findUnique({
    where: { id: value },
    select: { id: true },
  })
  return tenant?.id ?? null
}

export async function listTenants() {
  return prisma.tenant.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      domain: true,
      createdAt: true,
    },
  })
}

export async function getTenantById(id: string) {
  return prisma.tenant.findUnique({ where: { id } })
}

export async function getTenantBySlug(slug: string) {
  return prisma.tenant.findUnique({ where: { slug } })
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
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { theme: true },
  })
  if (!tenant) throw new Error(`Tenant ${tenantId} not found.`)

  const stored = tenant.theme
  const isEmpty =
    stored == null ||
    (typeof stored === "object" && Object.keys(stored).length === 0)

  return isEmpty ? defaultTheme : (stored as unknown as Theme)
}
