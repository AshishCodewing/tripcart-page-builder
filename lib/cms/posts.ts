import { desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { posts } from "@/lib/schema"

export async function getPostById(id: string) {
  return db.query.posts.findFirst({ where: eq(posts.id, id) })
}

export async function listAllPosts(tenantId?: string) {
  return db.query.posts.findMany({
    where: tenantId ? eq(posts.tenantId, tenantId) : undefined,
    orderBy: [desc(posts.updatedAt)],
    columns: {
      id: true,
      title: true,
      slug: true,
      status: true,
      updatedAt: true,
      publishedAt: true,
    },
    with: {
      tenant: { columns: { id: true, name: true, slug: true } },
    },
  })
}
