import { SiteChrome } from "../../site-chrome"

// Chrome layout for a single blog post (`/preview/<id>/posts/<slug>`). Wraps
// the post in the chrome assigned to the "single" template-hierarchy slug
// (WP's `single.php`). The `(single)` route group keeps this distinct from the
// blog index and the taxonomy archives.
export default async function PostsSingleChromeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantId: string }>
}) {
  const { tenantId } = await params
  return (
    <SiteChrome tenantId={tenantId} segment="single">
      {children}
    </SiteChrome>
  )
}
