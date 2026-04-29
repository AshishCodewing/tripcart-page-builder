import { prisma } from "@/lib/prisma"

export async function getPostById(id: string) {
  return prisma.post.findUnique({ where: { id } })
}

export async function listAllPosts() {
  return prisma.post.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      updatedAt: true,
      publishedAt: true,
    },
  })
}
