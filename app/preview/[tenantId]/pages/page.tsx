import Link from "next/link"

import { prisma } from "@/lib/prisma"

// Preview-only pages index, scoped to the tenant. Draft mode + theme are
// gated once by `[tenantId]/layout.tsx`. Public rendering happens elsewhere.
export default async function PagesIndexPreview({
  params,
}: {
  params: Promise<{ tenantId: string }>
}) {
  const { tenantId } = await params

  const pages = await prisma.page.findMany({
    where: { tenantId },
    orderBy: [{ path: "asc" }],
    select: {
      id: true,
      path: true,
      title: true,
      status: true,
      updatedAt: true,
    },
  })

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-8 text-3xl font-semibold">Pages (preview)</h1>
      {pages.length === 0 ? (
        <p className="text-muted-foreground">No pages yet.</p>
      ) : (
        <ul className="space-y-6">
          {pages.map((page) => (
            <li key={page.id}>
              <Link
                href={`/preview/${tenantId}/pages/${page.path}`}
                className="text-xl font-medium hover:underline"
              >
                {page.title}
              </Link>
              <div className="text-sm text-muted-foreground">
                /{page.path} · {page.status}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
