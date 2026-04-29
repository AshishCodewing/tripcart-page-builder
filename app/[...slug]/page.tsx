import { draftMode } from "next/headers"
import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"

// Preview-only catch-all. Public rendering of CMS pages happens in a
// separate deployment that consumes this DB; here we serve the current
// editor draft when draft mode is active, and 404 otherwise.
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

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: page.css }} />
      <div dangerouslySetInnerHTML={{ __html: page.html }} />
    </>
  )
}
