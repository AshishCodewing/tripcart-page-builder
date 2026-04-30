"use server"

import { updateTag } from "next/cache"
import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"

import { cacheTags } from "./cache-tags"
import { validateSlug } from "./path"

export async function createPost(form: FormData): Promise<void> {
  const slug = String(form.get("slug") ?? "").trim()
  const title = String(form.get("title") ?? "").trim()

  if (!title) throw new Error("Title is required.")
  validateSlug(slug)

  const post = await prisma.post.create({ data: { slug, title } })
  redirect(`/admin/posts/${post.id}/edit`)
}

export async function savePost(id: string, form: FormData): Promise<void> {
  const existing = await prisma.post.findUnique({ where: { id } })
  if (!existing) throw new Error("Post not found.")

  const newSlug = String(form.get("slug") ?? existing.slug).trim()
  const title = String(form.get("title") ?? existing.title).trim()
  const excerpt = (form.get("excerpt") as string) || null
  const status =
    (form.get("status") as "DRAFT" | "PUBLISHED") ?? existing.status

  validateSlug(newSlug)

  // Same MVP rule as pages: don't allow renaming a published post until
  // the Redirect table is wired up.
  if (newSlug !== existing.slug && existing.status === "PUBLISHED") {
    throw new Error(
      "Renaming a published post is not supported yet (redirects are post-MVP). Move it back to draft first."
    )
  }

  const wasPublished = existing.status === "PUBLISHED"
  const willBePublished = status === "PUBLISHED"

  await prisma.post.update({
    where: { id },
    data: {
      slug: newSlug,
      title,
      excerpt,
      status,
      publishedAt:
        willBePublished && !wasPublished ? new Date() : existing.publishedAt,
    },
  })

  updateTag(cacheTags.post(existing.slug))
  if (newSlug !== existing.slug) updateTag(cacheTags.post(newSlug))
  if (wasPublished !== willBePublished) updateTag(cacheTags.postIndex)
}

export async function deletePost(id: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id },
    select: { slug: true, status: true },
  })
  if (!post) return
  await prisma.post.delete({ where: { id } })
  updateTag(cacheTags.post(post.slug))
  if (post.status === "PUBLISHED") updateTag(cacheTags.postIndex)
  redirect("/admin/posts")
}
