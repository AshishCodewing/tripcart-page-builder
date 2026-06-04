import Link from "next/link"
import { notFound } from "next/navigation"

import TenantThemeEditor from "@/components/admin/tenant-theme/tenant-theme-editor"
import { getTenantById, getTenantTheme } from "@/lib/cms/tenants"

export default async function TenantThemePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const tenant = await getTenantById(id)
  if (!tenant) notFound()

  const theme = await getTenantTheme(id)

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b px-6 py-3">
        <Link
          href={`/admin/tenants/${tenant.id}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← {tenant.name}
        </Link>
        <h1 className="text-lg leading-none font-semibold">Theme</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <p className="text-sm text-muted-foreground">
            Brand tokens and presets for this tenant. Changes apply to every
            page and post that belongs to {tenant.name}.
          </p>

          <TenantThemeEditor tenantId={tenant.id} initialTheme={theme} />
        </div>
      </main>
    </div>
  )
}
