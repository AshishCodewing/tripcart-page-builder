import Link from "next/link"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { deletePost, savePost } from "@/lib/cms/post-actions"
import { getPostById } from "@/lib/cms/posts"

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getPostById(id)
  if (!post) notFound()

  const saveAction = savePost.bind(null, id)
  const deleteAction = deletePost.bind(null, id)

  const isPublished = post.status === "PUBLISHED"

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <Link
            href="/admin/posts"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Posts
          </Link>
          <h1 className="text-2xl font-semibold">Edit post</h1>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/preview?path=/blog/${encodeURIComponent(post.slug)}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Preview ↗
          </a>
          <span className="font-mono text-xs text-muted-foreground">
            /blog/{post.slug}
          </span>
        </div>
      </header>

      <form action={saveAction} className="space-y-4 rounded-lg border p-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" defaultValue={post.title} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            name="slug"
            defaultValue={post.slug}
            pattern="[a-z0-9-]+"
            required
            disabled={isPublished}
          />
          {isPublished && (
            <p className="mt-1 text-xs text-muted-foreground">
              Move to draft to rename. Redirects ship post-MVP.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="excerpt">Excerpt</Label>
          <Textarea
            id="excerpt"
            name="excerpt"
            defaultValue={post.excerpt ?? ""}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={post.status}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>

        <div className="flex gap-2">
          <Button type="submit">Save</Button>
        </div>
      </form>

      {/* TODO: mount <PageEditor /> here once GrapesJS save is wired up. */}
      <section className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        GrapesJS editor mounts here.
      </section>

      <form action={deleteAction}>
        <Button type="submit" variant="destructive" size="sm">
          Delete post
        </Button>
      </form>
    </div>
  )
}
