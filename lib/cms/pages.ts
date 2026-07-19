import { cache } from "react"

import { and, asc, eq, ne } from "drizzle-orm"

import { db } from "@/lib/db"
import { pages } from "@/lib/schema"

export async function getPageById(id: string) {
  return db.query.pages.findFirst({ where: eq(pages.id, id) })
}

// Per-request-memoized page lookup by (tenantId, path). Wrapped in React's
// `cache` so multiple consumers in one render pass share a single query.
// Used by the preview page route.
export const getPageByPath = cache((tenantId: string, path: string) =>
  db.query.pages.findFirst({
    where: and(eq(pages.tenantId, tenantId), eq(pages.path, path)),
  })
)

export async function listPages(tenantId?: string) {
  return db.query.pages.findMany({
    where: tenantId ? eq(pages.tenantId, tenantId) : undefined,
    orderBy: [asc(pages.path)],
    columns: {
      id: true,
      title: true,
      path: true,
      status: true,
      updatedAt: true,
      parentId: true,
    },
    with: {
      tenant: { columns: { id: true, name: true, slug: true } },
    },
  })
}

export async function listPageParents(excludeId?: string) {
  return db.query.pages.findMany({
    where: excludeId ? ne(pages.id, excludeId) : undefined,
    orderBy: [asc(pages.path)],
    columns: { id: true, title: true, path: true },
  })
}
