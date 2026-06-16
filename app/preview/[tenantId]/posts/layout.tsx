import { SiteChrome } from "../site-chrome"

// Chrome layout for blog/post routes (`/preview/<id>/posts/...`). Wraps post
// content in the chrome assigned to the "posts" segment.
//
// NOTE: this layout also wraps the taxonomy archives nested under `posts/`
// (categories / tags / authors), so they currently inherit the "posts"
// chrome. The `categories` / `tags` / `authors` segments exist in the data
// model (CHROME_SEGMENTS) but giving them independent chrome needs the
// archive routes flattened out from under `posts/` (or route groups) — a
// follow-up; see project_chrome_multi_header.
export default async function PostsChromeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantId: string }>
}) {
  const { tenantId } = await params
  return (
    <SiteChrome tenantId={tenantId} segment="posts">
      {children}
    </SiteChrome>
  )
}
