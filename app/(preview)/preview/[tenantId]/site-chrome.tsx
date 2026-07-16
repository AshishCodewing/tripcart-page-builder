import type { ProjectData } from "grapesjs"

import { resolveSegmentChrome } from "@/lib/cms/chrome"
import type { TemplateHierarchySlug } from "@/lib/cms/template-hierarchy"
import { patternComponents } from "@/lib/plugins/patterns"
import {
  RenderProjectFragment,
  type ProjectDefinition,
} from "@/lib/plugins/react-renderer/project"
import { filterProtectedStyles } from "@/lib/plugins/tc-storage-adapter"

// Renders one route segment's site chrome: the assigned header above the page
// content and the assigned footer below it. Each preview segment layout wraps
// its `{children}` in this. Resolving per-segment (via `resolveSegmentChrome`)
// is what lets `pages/` and `posts/` show different headers (Piece 2). Because
// the segment layout stays mounted across same-segment navigation, the chrome
// (and any client state in it) persists; crossing segments swaps the frame.
//
// This is the same render the preview root layout used to do inline, lifted
// here so it can vary by segment. The draft gate + theme link stay in the
// root layout (tenant-wide, not segment-specific).
export async function SiteChrome({
  tenantId,
  segment,
  children,
}: {
  tenantId: string
  segment: TemplateHierarchySlug
  children: React.ReactNode
}) {
  const { header, footer } = await resolveSegmentChrome(tenantId, segment)

  return (
    <>
      {header && (
        <RenderProjectFragment
          projectData={
            filterProtectedStyles(header as ProjectData) as ProjectDefinition
          }
          config={{ components: patternComponents }}
          parentId="site-header"
          bare
        />
      )}
      {children}
      {footer && (
        <RenderProjectFragment
          projectData={
            filterProtectedStyles(footer as ProjectData) as ProjectDefinition
          }
          config={{ components: patternComponents }}
          parentId="site-footer"
          bare
        />
      )}
    </>
  )
}
