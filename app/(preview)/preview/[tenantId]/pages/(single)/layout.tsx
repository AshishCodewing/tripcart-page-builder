import { SiteChrome } from "../../site-chrome"

// Chrome layout for a single CMS Page (`/preview/<id>/pages/<slug>`). Wraps
// the page content in the chrome assigned to the "page" template-hierarchy
// slug (WP's `page.php`) — distinct from the Pages listing, which resolves
// "archive" in the sibling `(archive)/layout.tsx`.
//
// The `(single)` route group is what makes that distinction possible: it
// isolates this subtree from the listing so they don't share a chrome layout
// (App Router layouts stack, they don't override).
export default async function PagesSingleChromeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantId: string }>
}) {
  const { tenantId } = await params
  return (
    <SiteChrome tenantId={tenantId} segment="page">
      {children}
    </SiteChrome>
  )
}
