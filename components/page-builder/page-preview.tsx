// Server-rendered preview of a saved page.
//
// The project renderer's RenderProject + RenderPage emit a full <html>
// document, which is the right shape for a standalone publish deployment.
// Inside this Next.js app, however, the layout already provides <html> and
// <body>, so we render the wrapper component's children inline (via the
// shared `RenderProjectFragment`), which emits the per-page CSS as a
// hoistable <style> that React lifts into <head>.
//
// Tenant theme composition is handled one layer up by
// `app/preview/[tenantId]/layout.tsx`, which fetches the tenant's brand theme
// and emits its compiled CSS once for the whole preview subtree. This
// component only deals with page-scoped rules. `filterProtectedStyles`
// strips any theme rules legacy publishes baked into `page.data` so
// they don't override the layout's fresh tenant theme.

import type { ElementType } from "react"

import { InteractiveComponentsLoader } from "@/components/page-builder/interactive-components-loader"
import { usesInteractiveComponents } from "@/lib/plugins/interactive/tags"
import { filterProtectedStyles } from "@/lib/plugins/tc-storage-adapter"
import {
  RenderProjectFragment,
  type ProjectDefinition,
} from "@/lib/plugins/react-renderer/project"
import type { RendererReactOptions } from "@/lib/plugins/react-renderer"
import type { ProjectData } from "grapesjs"

interface Props {
  // The JSON returned by `editor.getProjectData()` and persisted on the
  // Page row. Typed loosely because Prisma surfaces the column as `Json`.
  projectData: unknown
  config?: RendererReactOptions
  // Host element for the content. Defaults to "div". The page route passes
  // "main" so page content is the <main> landmark between header/footer; the
  // blog-post route leaves it a div (the content already sits inside an
  // <article>, where <main> is invalid).
  rootTag?: ElementType
}

export function PagePreview({ projectData, config, rootTag = "div" }: Props) {
  if (!projectData || typeof projectData !== "object") {
    return <PreviewEmpty reason="No saved project data." />
  }

  // Strip protected (theme) rules from page data. The publish path now
  // filters these on the way out, but pages published before that
  // landed still carry a stale theme snapshot in `data.styles`; without
  // this defensive filter, the snapshot's `:root` rule would win the
  // cascade against the layout's fresh tenant theme (same selector,
  // same specificity, and page CSS is hoisted after the theme link —
  // its "tc-page" precedence group ranks behind the link's "default").
  const filtered = filterProtectedStyles(projectData as ProjectData)

  // The wrapper component maps to <body>; we're already inside the host
  // page's body, so the shared fragment renderer strips it and emits the
  // page's children + CSS on a host element carrying the wrapper's classes.
  return (
    <>
      <RenderProjectFragment
        projectData={filtered as ProjectDefinition}
        config={config}
        parentId="preview"
        rootTag={rootTag}
        emptyFallback={<PreviewEmpty reason="Project has no pages or frames." />}
      />
      {/* Load the interactive web-component runtime only when the page uses one,
          so pages without tabs/etc. ship zero web-component JS. */}
      {usesInteractiveComponents(filtered) && <InteractiveComponentsLoader />}
    </>
  )
}

function PreviewEmpty({ reason }: { reason: string }) {
  return (
    <div className="p-8 text-sm text-muted-foreground">
      <p>This page has not been saved yet.</p>
      <p className="mt-1 text-xs">{reason}</p>
    </div>
  )
}
