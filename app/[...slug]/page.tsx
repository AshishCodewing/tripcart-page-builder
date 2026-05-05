import { draftMode } from "next/headers"
import { notFound } from "next/navigation"

import { PagePreview } from "@/components/page-builder/page-preview"
import { prisma } from "@/lib/prisma"

// Preview-only catch-all. Public rendering of CMS pages happens in a
// separate deployment that consumes this DB; here we serve the current
// editor draft when draft mode is active, and 404 otherwise.
//
// Rendering uses the React-renderer project module against the persisted
// project JSON so React-component patterns (e.g. <HeroSection/>) stay in
// React end-to-end.
export default async function PreviewCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { isEnabled: isDraft } = await draftMode()
  if (!isDraft) notFound()

  const { slug } = await params
  const path = slug.join("/")
  const page = await prisma.page.findUnique({ where: { path } })
  if (!page) notFound()

  return <PagePreview projectData={page.data} />
}
