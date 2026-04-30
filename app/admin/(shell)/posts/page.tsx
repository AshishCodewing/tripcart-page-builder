import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createPost } from "@/lib/cms/post-actions"
import { listAllPosts } from "@/lib/cms/posts"

export default async function AdminPostsList() {
  const posts = await listAllPosts()

  return (
    <div className="space-y-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Posts</h1>
        <span className="text-sm text-muted-foreground">
          {posts.length} total
        </span>
      </header>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">New post</h2>
        <form action={createPost} className="flex flex-wrap items-end gap-3">
          <div className="grow space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="grow space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" name="slug" pattern="[a-z0-9-]+" required />
          </div>
          <Button type="submit">Create</Button>
        </form>
      </section>

      <section>
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="font-mono text-xs">
                    /blog/{p.slug}
                  </TableCell>
                  <TableCell>{p.status}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.updatedAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/posts/${p.id}/edit`}
                      className="text-primary hover:underline"
                    >
                      Edit
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
