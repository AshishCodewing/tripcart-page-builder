import { SiteChrome } from "../../site-chrome"

// Chrome layout for the blog index (`/preview/<id>/posts`). Wraps the post
// listing in the chrome assigned to the "home" template-hierarchy slug (WP's
// Blog Home — the posts page). The `(index)` route group isolates it from the
// single-post and taxonomy subtrees so each resolves its own chrome (App
// Router layouts stack, they don't override).
export default async function PostsIndexChromeLayout({
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
