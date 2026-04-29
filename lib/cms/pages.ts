import { prisma } from "@/lib/prisma"

export async function getPageById(id: string) {
  return prisma.page.findUnique({ where: { id } })
}

export async function listPages() {
  return prisma.page.findMany({
    orderBy: [{ path: "asc" }],
    select: {
      id: true,
      title: true,
      path: true,
      status: true,
      updatedAt: true,
      parentId: true,
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
