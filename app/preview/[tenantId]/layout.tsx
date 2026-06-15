import { draftMode } from "next/headers"
import { notFound } from "next/navigation"

import { resolveChromeBySlug } from "@/lib/cms/templates"
import { defaultFooter, defaultHeader } from "@/lib/plugins/parts"
import { filterProtectedStyles } from "@/lib/plugins/tc-storage-adapter"
import { patternComponents } from "@/lib/plugins/patterns"
import {
  RenderProjectFragment,
  type ProjectDefinition,
} from "@/lib/plugins/react-renderer/project"
import { prisma } from "@/lib/prisma"
import type { ProjectData } from "grapesjs"

// Shared layout for every preview route. Reads `tenantId` from the URL
// segment (set by `/api/preview` when the editor launches a preview
// session) and enqueues the tenant's compiled brand theme as a
// stylesheet via `/api/preview/theme/[tenantId]/[version]/theme.css`.
// Per-page previews (`PagePreview`) only emit their own page-scoped CSS
// on top.
//
// `themeVersion` rides on the URL as an immutable cache key —
// `updateTenantTheme` bumps it on every write, so the URL the browser
// sees rotates on each edit and the old cached stylesheet is harmlessly
// abandoned. See the route handler for the full contract.
//
// This is the server-side mirror of what `designSystemPlugin` does in
// the editor canvas: a single `:root` rule plus body / element /
// component defaults so `var(--tc--preset--*)` references resolve
// regardless of which preview route the user landed on.
//
// Single draft-mode gate for the whole preview subtree. Preview only
// serves the editor draft, so a request without draft mode 404s here —
// once, above everything. Nothing below (the zone layout, the page, the
// blog routes) re-checks: a `notFound()` in a layout renders the
// not-found boundary and skips this layout's children entirely, so a
// non-draft request never resolves chrome or queries the page. Entry is
// always via `/api/preview`, which enables draft and redirects in.
export default async function PreviewLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantId: string }>
}) {
  const { isEnabled: isDraft } = await draftMode()
  if (!isDraft) notFound()

  const { tenantId } = await params

  // Bad/stale tenant IDs land here too — skip the link rather than 404
  // the layout, since the page below will notFound() with the right
  // context. Read the chrome assignments alongside the theme version.
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, themeVersion: true },
  })

  // Site chrome (the "site owns the frame" model): the header/footer are
  // rendered once here in the layout, so they persist across navigation
  // (this segment is above the page/post routes and doesn't remount). Each
  // slot is the tenant's template at the reserved slug "header" / "footer"
  // (resolved tenant-first / global-fallback by `resolveChromeBySlug`, the
  // WP way of referencing template parts), falling back to the code-defined
  // default part (`lib/plugins/parts`) when no such template exists — the
  // same default-in-code / DB-override model as the theme system.
  let header: ProjectDefinition | null = null
  let footer: ProjectDefinition | null = null
  if (tenant) {
    header =
      (await resolveChromeBySlug(tenantId, "header")) ??
      defaultHeader(tenant.name)
    footer =
      (await resolveChromeBySlug(tenantId, "footer")) ??
      defaultFooter(tenant.name)
  }

  return (
    <>
      {tenant && (
        <link
          rel="stylesheet"
          href={`/api/preview/theme/${tenantId}/${tenant.themeVersion}/theme.css`}
          precedence="default"
        />
      )}
      {header && (
        <RenderProjectFragment
          projectData={
            filterProtectedStyles(header as ProjectData) as ProjectDefinition
          }
          config={{ components: patternComponents }}
          parentId="site-header"
          bare
        />
      )}
      {children}
      {footer && (
        <RenderProjectFragment
          projectData={
            filterProtectedStyles(footer as ProjectData) as ProjectDefinition
          }
          config={{ components: patternComponents }}
          parentId="site-footer"
          bare
        />
      )}
    </>
  )
}
