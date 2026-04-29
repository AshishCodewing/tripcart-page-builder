import Link from "next/link"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { deletePage, savePage } from "@/lib/cms/page-actions"
import { getPageById, listPageParents } from "@/lib/cms/pages"

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [page, parentOptions] = await Promise.all([
    getPageById(id),
    listPageParents(id),
  ])
  if (!page) notFound()

  const saveAction = savePage.bind(null, id)
  const deleteAction = deletePage.bind(null, id)

  const isPublished = page.status === "PUBLISHED"

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <Link
            href="/admin/pages"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Pages
          </Link>
          <h1 className="text-2xl font-semibold">Edit page</h1>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/preview?path=/${encodeURIComponent(page.path)}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Preview ↗
          </a>
          <span className="font-mono text-xs text-muted-foreground">
            /{page.path}
          </span>
        </div>
      </header>

      <form action={saveAction} className="space-y-4 rounded-lg border p-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" defaultValue={page.title} required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              defaultValue={page.slug}
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
            <Label htmlFor="parentId">Parent</Label>
            <select
              id="parentId"
              name="parentId"
              defaultValue={page.parentId ?? ""}
              disabled={isPublished}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">— Top level —</option>
              {parentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.title} (/{opt.path})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={page.status}
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

      {/* TODO: mount <PageEditor /> here once the GrapesJS save flow is wired
          to write html/css/data back to this row. */}
      <section className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        GrapesJS editor mounts here.
      </section>

      <form action={deleteAction}>
        <Button type="submit" variant="destructive" size="sm">
          Delete page
        </Button>
      </form>
    </div>
  )
}
