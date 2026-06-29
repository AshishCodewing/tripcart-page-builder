import { notFound } from "next/navigation"

import TenantThemeEditor from "./tenant-theme-editor"
import { getTenantById, getTenantTheme } from "@/lib/cms/tenants"

export default async function ThemeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const tenant = await getTenantById(id)
  if (!tenant) notFound()

  const theme = await getTenantTheme(id)

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Theme</h1>
        <p className="text-sm text-muted-foreground">
          Brand tokens and presets for this tenant. Changes apply to every page
          and post that belongs to {tenant.name}.
        </p>
      </header>

      <TenantThemeEditor tenantId={tenant.id} initialTheme={theme}>
        {children}
      </TenantThemeEditor>
    </div>
  )
}
