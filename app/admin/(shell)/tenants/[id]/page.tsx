import Link from "next/link"
import { notFound } from "next/navigation"

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
import { createPage } from "@/lib/cms/page-actions"
import { listPages } from "@/lib/cms/pages"
import { createPost } from "@/lib/cms/post-actions"
import { listAllPosts } from "@/lib/cms/posts"
import { deleteTenant, updateTenant } from "@/lib/cms/tenant-actions"
import { getTenantById } from "@/lib/cms/tenants"

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const tenant = await getTenantById(id)
  if (!tenant) notFound()

  const [pages, posts] = await Promise.all([listPages(id), listAllPosts(id)])

  const updateAction = updateTenant.bind(null, id)
  const deleteAction = deleteTenant.bind(null, id)

  return (
    <div className="space-y-10">
      <header className="flex items-baseline justify-between">
        <div className="space-y-1">
          <Link
            href="/admin/tenants"
            className="text-xs text-muted-foreground hover:underline"
          >
            ← All tenants
          </Link>
          <h1 className="text-2xl font-semibold">{tenant.name}</h1>
          <p className="font-mono text-xs text-muted-foreground">
            {tenant.slug}
            {tenant.domain ? ` · ${tenant.domain}` : ""}
          </p>
        </div>
      </header>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">Tenant details</h2>
        <form action={updateAction} className="flex flex-wrap items-end gap-3">
          <div className="grow space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={tenant.name}
              required
            />
          </div>
          <div className="grow space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              pattern="[a-z0-9\-]+"
              defaultValue={tenant.slug}
              required
            />
          </div>
          <div className="grow space-y-2">
            <Label htmlFor="domain">Domain (optional)</Label>
            <Input
              id="domain"
              name="domain"
              placeholder="acme.com"
              defaultValue={tenant.domain ?? ""}
            />
          </div>
          <Button type="submit">Save</Button>
        </form>
        <form action={deleteAction} className="mt-3">
          <Button type="submit" variant="destructive" size="sm">
            Delete tenant
          </Button>
        </form>
      </section>

      <section className="space-y-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Pages</h2>
          <span className="text-sm text-muted-foreground">
            {pages.length} total
          </span>
        </header>

        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">New page</h3>
          <form action={createPage} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="tenantId" value={tenant.id} />
            <div className="grow space-y-2">
              <Label htmlFor="page-title">Title</Label>
              <Input id="page-title" name="title" required />
            </div>
            <div className="grow space-y-2">
              <Label htmlFor="page-slug">Slug</Label>
              <Input
                id="page-slug"
                name="slug"
                pattern="[a-z0-9\-]+"
                required
              />
            </div>
            <Button type="submit">Create</Button>
          </form>
        </div>

        {pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pages yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="font-mono text-xs">/{p.path}</TableCell>
                  <TableCell>{p.status}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.updatedAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/pages/${p.id}/edit`}
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

      <section className="space-y-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Posts</h2>
          <span className="text-sm text-muted-foreground">
            {posts.length} total
          </span>
        </header>

        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">New post</h3>
          <form action={createPost} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="tenantId" value={tenant.id} />
            <div className="grow space-y-2">
              <Label htmlFor="post-title">Title</Label>
              <Input id="post-title" name="title" required />
            </div>
            <div className="grow space-y-2">
              <Label htmlFor="post-slug">Slug</Label>
              <Input
                id="post-slug"
                name="slug"
                pattern="[a-z0-9\-]+"
                required
              />
            </div>
            <Button type="submit">Create</Button>
          </form>
        </div>

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
