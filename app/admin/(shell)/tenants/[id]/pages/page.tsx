import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createPage } from "@/lib/cms/page-actions"
import { listPages } from "@/lib/cms/pages"
import { getTenantById } from "@/lib/cms/tenants"

import { PagesDataTable } from "./pages-data-table"

export default async function TenantPagesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const tenant = await getTenantById(id)
  if (!tenant) notFound()

  const pages = await listPages(id)

  return (
    <section className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Pages</h1>
        <span className="text-sm text-muted-foreground">
          {pages.length} total
        </span>
      </header>

      <div className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">New page</h2>
        <form action={createPage} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <div className="grow space-y-2">
            <Label htmlFor="page-title">Title</Label>
            <Input id="page-title" name="title" required />
          </div>
          <div className="grow space-y-2">
            <Label htmlFor="page-slug">Slug</Label>
            <Input id="page-slug" name="slug" pattern="[a-z0-9\-]+" required />
          </div>
          <Button type="submit">Create</Button>
        </form>
      </div>

      {pages.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pages yet.</p>
      ) : (
        <PagesDataTable tenantId={tenant.id} items={pages} />
      )}
    </section>
  )
}
