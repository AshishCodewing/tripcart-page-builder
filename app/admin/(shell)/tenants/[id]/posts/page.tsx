import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createPost } from "@/lib/cms/post-actions"
import { listAllPosts } from "@/lib/cms/posts"
import { getTenantById } from "@/lib/cms/tenants"

import { PostsDataTable } from "./posts-data-table"

export default async function TenantPostsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const tenant = await getTenantById(id)
  if (!tenant) notFound()

  const posts = await listAllPosts(id)

  return (
    <section className="space-y-4 p-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Posts</h1>
        <span className="text-sm text-muted-foreground">
          {posts.length} total
        </span>
      </header>

      <div className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">New post</h2>
        <form action={createPost} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <div className="grow space-y-2">
            <Label htmlFor="post-title">Title</Label>
            <Input id="post-title" name="title" required />
          </div>
          <div className="grow space-y-2">
            <Label htmlFor="post-slug">Slug</Label>
            <Input id="post-slug" name="slug" pattern="[a-z0-9\-]+" required />
          </div>
          <Button type="submit">Create</Button>
        </form>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No posts yet.</p>
      ) : (
        <PostsDataTable tenantId={tenant.id} items={posts} />
      )}
    </section>
  )
}
