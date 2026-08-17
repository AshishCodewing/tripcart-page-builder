"use server"

import { updateTag } from "next/cache"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { posts } from "@/lib/schema"
import { deleteThreadsForContent } from "@/lib/ai/persistence"

import { cacheTags } from "./cache-tags"
import { validateSlug } from "./path"
import {
  buildDraftDataUpdate,
  computePublishTimestamp,
  parseOptionalProjectData,
} from "./actions-shared"

export async function createPost(form: FormData): Promise<void> {
  const slug = String(form.get("slug") ?? "").trim()
  const title = String(form.get("title") ?? "").trim()
  const tenantId = String(form.get("tenantId") ?? "").trim()

  if (!title) throw new Error("Title is required.")
  if (!tenantId) throw new Error("Tenant is required.")
  validateSlug(slug)

  const [post] = await db
    .insert(posts)
    .values({ slug, title, tenantId })
    .returning({ id: posts.id })
  redirect(`/admin/posts/${post.id}/edit`)
}

// NB: `tenantId` is intentionally NOT read or written here. Post tenancy
// is immutable post-creation — a post belongs to the tenant it was
// created under, and reassigning it would orphan its theme references.
export async function savePost(id: string, form: FormData): Promise<void> {
  const existing = await db.query.posts.findFirst({ where: eq(posts.id, id) })
  if (!existing) throw new Error("Post not found.")

  const newSlug = String(form.get("slug") ?? existing.slug).trim()
  const title = String(form.get("title") ?? existing.title).trim()
  const excerpt = (form.get("excerpt") as string) || null
  const status =
    (form.get("status") as "DRAFT" | "PUBLISHED") ?? existing.status

  // The editor populates this on submit (see EditorShell). Optional here
  // because non-editor callers (e.g. metadata-only updates from the post
  // index) will omit it — in which case we keep the previous value.
  const data = parseOptionalProjectData(form)

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

  await db
    .update(posts)
    .set({
      slug: newSlug,
      title,
      excerpt,
      status,
      publishedAt: computePublishTimestamp(
        wasPublished,
        willBePublished,
        existing.publishedAt
      ),
      ...buildDraftDataUpdate(data),
    })
    .where(eq(posts.id, id))

  updateTag(cacheTags.post(existing.slug))
  if (newSlug !== existing.slug) updateTag(cacheTags.post(newSlug))
  if (wasPublished !== willBePublished) updateTag(cacheTags.postIndex)
}

export async function deletePost(id: string): Promise<void> {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    columns: { slug: true, status: true, tenantId: true },
  })
  if (!post) return
  await db.delete(posts).where(eq(posts.id, id))
  await deleteThreadsForContent("post", id)
  updateTag(cacheTags.post(post.slug))
  if (post.status === "PUBLISHED") updateTag(cacheTags.postIndex)
  redirect(`/admin/tenants/${post.tenantId}`)
}
