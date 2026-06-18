import { SiteChrome } from "../../site-chrome"

// Chrome layout for the Pages *listing* (`/preview/<id>/pages`). Wraps the
// index in the chrome assigned to the "archive" template-hierarchy slug.
//
// The `(archive)` route group keeps this layout off the single-page subtree:
// the listing and a single page are siblings, not parent/child, so each gets
// exactly one chrome layout and they can differ. App Router layouts stack
// rather than override, so this separation is what lets a single page resolve
// a different header (see `(single)/layout.tsx`).
export default async function PagesArchiveChromeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantId: string }>
}) {
  const { tenantId } = await params
  return (
    <SiteChrome tenantId={tenantId} segment="archive">
      {children}
    </SiteChrome>
  )
}
