import { SiteChrome } from "../site-chrome"

// Chrome layout for the tenant home / front page. Wraps the home content in
// the chrome assigned to the "home" template-hierarchy slug (WP's Blog Home).
// Sits in the `(home)` route group so home can have its own chrome distinct
// from `pages/` and `posts/` without the root layout (which is now
// chrome-less) double-rendering it.
export default async function HomeChromeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantId: string }>
}) {
  const { tenantId } = await params
  return (
    <SiteChrome tenantId={tenantId} segment="home">
      {children}
    </SiteChrome>
  )
}
