import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { deleteTenant, updateTenant } from "@/lib/cms/tenant-actions"
import { getTenantById } from "@/lib/cms/tenants"

export default async function TenantSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const tenant = await getTenantById(id)
  if (!tenant) notFound()

  const updateAction = updateTenant.bind(null, id)
  const deleteAction = deleteTenant.bind(null, id)

  return (
    <div className="space-y-10 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{tenant.name}</h1>
        <p className="font-mono text-xs text-muted-foreground">
          {tenant.slug}
          {tenant.domain ? ` · ${tenant.domain}` : ""}
        </p>
      </header>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">Tenant details</h2>
        <form action={updateAction} className="flex flex-wrap items-end gap-3">
          <div className="grow space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={tenant.name} required />
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
    </div>
  )
}
