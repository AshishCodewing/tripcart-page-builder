import { prisma } from "@/lib/prisma"

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
