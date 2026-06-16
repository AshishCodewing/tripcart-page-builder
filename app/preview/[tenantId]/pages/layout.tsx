import { SiteChrome } from "../site-chrome"

// Chrome layout for CMS Page routes (`/preview/<id>/pages/...`). Wraps page
// content in the chrome assigned to the "pages" segment. Stays mounted across
// page-to-page navigation, so the header/footer (and their client state)
// persist within this segment.
export default async function PagesChromeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantId: string }>
}) {
  const { tenantId } = await params
  return (
    <SiteChrome tenantId={tenantId} segment="pages">
      {children}
    </SiteChrome>
  )
}
