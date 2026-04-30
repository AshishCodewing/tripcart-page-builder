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
import { createPage } from "@/lib/cms/page-actions"
import { listPages } from "@/lib/cms/pages"

export default async function AdminPagesList() {
  const pages = await listPages()

  return (
    <div className="space-y-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Pages</h1>
        <span className="text-sm text-muted-foreground">
          {pages.length} total
        </span>
      </header>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">New page</h2>
        <form action={createPage} className="flex flex-wrap items-end gap-3">
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
    </div>
  )
}
