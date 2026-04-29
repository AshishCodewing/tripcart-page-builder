"use server"

import { updateTag } from "next/cache"
import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"

import { cacheTags } from "./cache-tags"
import {
  assertNotDescendant,
  buildPath,
  validateSlug,
  validateTopLevelSlug,
} from "./path"

export async function createPage(form: FormData): Promise<void> {
  const slug = String(form.get("slug") ?? "").trim()
  const title = String(form.get("title") ?? "").trim()
  const parentId = (form.get("parentId") as string) || null

  if (!title) throw new Error("Title is required.")
  validateSlug(slug)
  if (parentId === null) validateTopLevelSlug(slug)

  const path = await buildPath(slug, parentId)

  const page = await prisma.page.create({
    data: { slug, path, parentId, title },
  })

  updateTag(cacheTags.nav)
  redirect(`/admin/pages/${page.id}/edit`)
}

export async function savePage(id: string, form: FormData): Promise<void> {
  const existing = await prisma.page.findUnique({ where: { id } })
  if (!existing) throw new Error("Page not found.")

  const newSlug = String(form.get("slug") ?? existing.slug).trim()
  const newParentId = (form.get("parentId") as string) || null
  const title = String(form.get("title") ?? existing.title).trim()
  const status = (form.get("status") as "DRAFT" | "PUBLISHED") ?? existing.status

  validateSlug(newSlug)

  const wouldChangePath =
    newSlug !== existing.slug || newParentId !== existing.parentId

  // MVP rule: published pages cannot be renamed or reparented.
  // Lift this once the Redirect table is wired up post-MVP.
  if (wouldChangePath && existing.status === "PUBLISHED") {
    throw new Error(
      "Renaming or reparenting a published page is not supported yet (redirects are post-MVP). Move it back to draft first.",
    )
  }

  if (wouldChangePath) {
    await assertNotDescendant(id, newParentId)
    if (newParentId === null) validateTopLevelSlug(newSlug)
  }

  const path = wouldChangePath
    ? await buildPath(newSlug, newParentId)
    : existing.path

  const wasPublished = existing.status === "PUBLISHED"
  const willBePublished = status === "PUBLISHED"

  await prisma.page.update({
    where: { id },
    data: {
      slug: newSlug,
      parentId: newParentId,
      path,
      title,
      status,
      publishedAt:
        willBePublished && !wasPublished ? new Date() : existing.publishedAt,
    },
  })

  updateTag(cacheTags.page(existing.path))
  if (path !== existing.path) updateTag(cacheTags.page(path))
  if (wasPublished !== willBePublished) updateTag(cacheTags.nav)
}

export async function deletePage(id: string): Promise<void> {
  const page = await prisma.page.findUnique({
    where: { id },
    select: { path: true, status: true, _count: { select: { children: true } } },
  })
  if (!page) return
  if (page._count.children > 0) {
    throw new Error("Cannot delete a page that has child pages. Reparent or delete them first.")
  }
  await prisma.page.delete({ where: { id } })
  updateTag(cacheTags.page(page.path))
  if (page.status === "PUBLISHED") updateTag(cacheTags.nav)
  redirect("/admin/pages")
}
