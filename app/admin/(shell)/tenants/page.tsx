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
import { createTenant } from "@/lib/cms/tenant-actions"
import { listTenants } from "@/lib/cms/tenants"

export default async function AdminTenantsList() {
  const tenants = await listTenants()

  return (
    <div className="space-y-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Tenants</h1>
        <span className="text-sm text-muted-foreground">
          {tenants.length} total
        </span>
      </header>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">New tenant</h2>
        <form action={createTenant} className="flex flex-wrap items-end gap-3">
          <div className="grow space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="grow space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" name="slug" pattern="[a-z0-9\-]+" required />
          </div>
          <div className="grow space-y-2">
            <Label htmlFor="domain">Domain (optional)</Label>
            <Input id="domain" name="domain" placeholder="acme.com" />
          </div>
          <Button type="submit">Create</Button>
        </form>
      </section>

      <section>
        {tenants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tenants yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="hover:underline"
                    >
                      {t.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{t.slug}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {t.domain ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.createdAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="text-primary hover:underline"
                    >
                      Open
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
