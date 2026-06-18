import { SiteChrome } from "../../site-chrome"

// Chrome layout for the post taxonomy archives — categories, tags, authors
// (`/preview/<id>/posts/{categories,tags,authors}`). Wraps them in the chrome
// assigned to the "archive" template-hierarchy slug, WP's catch-all archive
// template. The `(taxonomy)` route group is what lifts these out from under
// the old shared `posts/layout.tsx` (which forced single-post chrome on them);
// the static segments still take precedence over the sibling `(single)/[slug]`
// dynamic route, so URLs are unchanged.
export default async function PostsTaxonomyChromeLayout({
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
