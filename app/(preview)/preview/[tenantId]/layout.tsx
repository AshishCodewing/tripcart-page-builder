import { draftMode } from "next/headers"
import { notFound } from "next/navigation"

import { findTenantTheme } from "@/lib/cms/tenants"
import { themeStylesheetKey } from "@/lib/theme/stylesheet-key"

// Shared layout for every preview route. Reads `tenantId` from the URL
// segment (set by `/api/preview` when the editor launches a preview
// session) and enqueues the tenant's compiled brand theme as a
// stylesheet via `/api/preview/theme/[tenantId]/[version]/theme.css`.
// Per-page previews (`PagePreview`) only emit their own page-scoped CSS
// on top.
//
// The `[version]` segment is a content hash of the compiled CSS
// (`themeStylesheetKey`), used as an immutable cache key. Hashing the
// output — rather than reading `Tenant.themeVersion` — means the URL also
// rotates when the compiler or the bundled defaults change, not only when
// the tenant saves; the version counter alone left browsers on stale CSS
// after such deploys. See the route handler for the full contract.
//
// This is the server-side mirror of what `designSystemPlugin` does in
// the editor canvas: a single `:root` rule plus body / element /
// component defaults so `var(--tc--preset--*)` references resolve
// regardless of which preview route the user landed on.
//
// Site chrome (header/footer) is NOT rendered here — it is rendered by the
// per-segment layouts (`(home)/layout.tsx`, `pages/layout.tsx`,
// `posts/layout.tsx`) via `<SiteChrome>`, so each route segment can show a
// different header/footer (Piece 2). This root layout only owns what is
// genuinely tenant-wide and segment-independent: the draft gate and the
// theme stylesheet.
//
// Single draft-mode gate for the whole preview subtree. Preview only
// serves the editor draft, so a request without draft mode 404s here —
// once, above everything. Nothing below (the segment layouts, the page,
// the blog routes) re-checks: a `notFound()` in a layout renders the
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
  // context.
  const theme = await findTenantTheme(tenantId)

  return (
    <>
      {theme && (
        <link
          rel="stylesheet"
          href={`/api/preview/theme/${tenantId}/${themeStylesheetKey(theme)}/theme.css`}
          precedence="default"
        />
      )}
      {/* The interactive web-component runtime is loaded per-page by
          <InteractiveComponentsLoader> (rendered by PagePreview only when the
          page uses one), via a client-only dynamic import. Styling ships with
          the component's `defaults.styles`, baked into the page CSS. */}
      {children}
    </>
  )
}
