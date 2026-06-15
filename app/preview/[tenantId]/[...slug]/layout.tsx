import { draftMode } from "next/headers"

import { getPageByPath } from "@/lib/cms/pages"
import { resolveLayoutChrome } from "@/lib/cms/templates"
import { filterProtectedStyles } from "@/lib/plugins/tc-storage-adapter"
import { patternComponents } from "@/lib/plugins/patterns"
import {
  RenderProjectFragment,
  type ProjectDefinition,
} from "@/lib/plugins/react-renderer/project"
import type { ProjectData } from "grapesjs"

// Approach-A zone chrome (docs/reference/templates-followups.md §14 +
// docs/reference/layout-render-fork.md). When the page below opts into a
// LAYOUT via `Page.layoutSlug`, this layout segment resolves that zone's
// chrome (header/footer PARTs expand server-side) and renders it around the
// page, dropping the page's content into the chrome's `content-slot` via the
// renderer's `config.slotContent`. The page itself (`page.tsx`) renders only
// its content fragment.
//
// Non-breaking: a page with `layoutSlug = null` — or a missing/empty zone —
// renders bare `{children}`, i.e. exactly today's behavior. The tenant brand
// theme is still emitted one level up by `[tenantId]/layout.tsx`; this layer
// adds only the zone chrome + its page-scoped CSS.
//
// This is the A2 fork (a dynamic layout co-located with `[...slug]`): correct
// render + chrome resolves independently of the page (instant-publish). It
// re-renders per navigation, so it does NOT persist interactive chrome state
// across page changes — that needs A1 (region routing), deferred. See the
// render-fork memo.
export default async function PreviewZoneLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantId: string; slug: string[] }>
}) {
  // Mirror the page's draft gate so we don't wrap a 404 / non-draft body in
  // chrome — the page below owns the real `notFound()`.
  const { isEnabled: isDraft } = await draftMode()
  if (!isDraft) return <>{children}</>

  const { tenantId, slug } = await params
  // Shared with page.tsx via React.cache — one query for both.
  const page = await getPageByPath(tenantId, slug.join("/"))

  // No page, or a self-contained page (no zone) → render bare, today's path.
  if (!page?.layoutSlug) return <>{children}</>

  const chrome = await resolveLayoutChrome(tenantId, page.layoutSlug)
  // Missing / empty zone degrades gracefully to a bare page (no crash).
  if (!chrome) return <>{children}</>

  // Strip any protected theme rules a LAYOUT baked into its data (same
  // defensive filter PagePreview applies to pages) so the outer tenant theme
  // wins the cascade. Chrome CSS renders before the page's own CSS (which
  // rides inside `children`), so the page can still override chrome.
  const filtered = filterProtectedStyles(chrome as ProjectData)

  return (
    <RenderProjectFragment
      projectData={filtered as ProjectDefinition}
      config={{ components: patternComponents, slotContent: children }}
      rootAttributes={{ "data-zone-root": page.layoutSlug }}
    />
  )
}
