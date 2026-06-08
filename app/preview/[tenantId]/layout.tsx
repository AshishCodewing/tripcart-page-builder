import { prisma } from "@/lib/prisma"

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
// No draft-mode check here — the underlying pages each call
// `draftMode()` and 404 themselves when it's off. The layout always
// runs above them; emitting a stylesheet link on a 404 render is fine.
export default async function PreviewLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantId: string }>
}) {
  const { tenantId } = await params

  // Bad/stale tenant IDs land here too — skip the link rather than 404
  // the layout, since the page below will notFound() with the right
  // context.
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { themeVersion: true },
  })

  return (
    <>
      {tenant && (
        <link
          rel="stylesheet"
          href={`/api/preview/theme/${tenantId}/${tenant.themeVersion}/theme.css`}
          precedence="default"
        />
      )}
      {children}
    </>
  )
}
