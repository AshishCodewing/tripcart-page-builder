import { prisma } from "@/lib/prisma"

export async function getPostById(id: string) {
  return prisma.post.findUnique({ where: { id } })
}

export async function listAllPosts(tenantId?: string) {
  return prisma.post.findMany({
    where: tenantId ? { tenantId } : undefined,
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      updatedAt: true,
      publishedAt: true,
      tenant: { select: { id: true, name: true, slug: true } },
    },
  })
}
