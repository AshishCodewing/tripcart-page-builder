import { cache } from "react"

import { prisma } from "@/lib/prisma"

export async function getPageById(id: string) {
  return prisma.page.findUnique({ where: { id } })
}

// Per-request-memoized page lookup by (tenantId, path). Wrapped in React's
// `cache` so multiple consumers in one render pass share a single query.
// Used by the preview page route.
export const getPageByPath = cache((tenantId: string, path: string) =>
  prisma.page.findUnique({ where: { tenantId_path: { tenantId, path } } })
)

export async function listPages(tenantId?: string) {
  return prisma.page.findMany({
    where: tenantId ? { tenantId } : undefined,
    orderBy: [{ path: "asc" }],
    select: {
      id: true,
      title: true,
      path: true,
      status: true,
      updatedAt: true,
      parentId: true,
      tenant: { select: { id: true, name: true, slug: true } },
    },
  })
}

export async function listPageParents(excludeId?: string) {
  return prisma.page.findMany({
    where: excludeId ? { id: { not: excludeId } } : undefined,
    orderBy: [{ path: "asc" }],
    select: { id: true, title: true, path: true },
  })
}
