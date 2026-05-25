// Server-rendered preview of a saved page.
//
// The project renderer's RenderProject + RenderPage emit a full <html>
// document, which is the right shape for a standalone publish deployment.
// Inside this Next.js app, however, the layout already provides <html> and
// <body>, so we render the wrapper component's children inline and inject
// the per-page CSS as a <style> block.
//
// Tenant theme composition is handled one layer up by
// `app/(preview)/layout.tsx`, which fetches the tenant's brand theme
// and emits its compiled CSS once for the whole preview subtree. This
// component only deals with page-scoped rules. `filterProtectedStyles`
// strips any theme rules legacy publishes baked into `page.data` so
// they don't override the layout's fresh tenant theme.

import { filterProtectedStyles } from "@/lib/plugins/tc-storage-adapter"
import {
  ProjectEditor,
  RenderComponent,
  type ProjectDefinition,
} from "@/lib/plugins/react-renderer/project"
import type { RendererReactOptions } from "@/lib/plugins/react-renderer"
import type { ProjectData } from "grapesjs"

interface Props {
  // The JSON returned by `editor.getProjectData()` and persisted on the
  // Page row. Typed loosely because Prisma surfaces the column as `Json`.
  projectData: unknown
  config?: RendererReactOptions
}

export function PagePreview({ projectData, config }: Props) {
  if (!projectData || typeof projectData !== "object") {
    return <PreviewEmpty reason="No saved project data." />
  }

  // Strip protected (theme) rules from page data. The publish path now
  // filters these on the way out, but pages published before that
  // landed still carry a stale theme snapshot in `data.styles`; without
  // this defensive filter, the snapshot's `:root` rule would win the
  // cascade against the layout's fresh tenant theme (same selector,
  // same specificity, page CSS comes later in source order).
  const filtered = filterProtectedStyles(projectData as ProjectData)
  const editor = new ProjectEditor(filtered as ProjectDefinition)
  const pageCss = editor.Css.getCssAsString()

  const root = editor.Pages.getAll()[0]?.frames[0]?.component
  if (!root) {
    return <PreviewEmpty reason="Project has no pages or frames." />
  }

  // The wrapper component maps to <body> in the project renderer's tag map;
  // since we're already inside the host page's body, render its children
  // directly and apply the wrapper's classes to a transparent host div.
  const wrapperClasses = root.classes.join(" ")

  return (
    <>
      {pageCss.length > 0 && (
        <style dangerouslySetInnerHTML={{ __html: pageCss }} />
      )}
      <div
        className={wrapperClasses || undefined}
        data-page-preview-root="true"
      >
        {root.components.map((child, i) => (
          <RenderComponent
            key={`${child.id ?? "n"}-${i}`}
            component={child}
            config={config}
            parentId="preview"
            index={i}
          />
        ))}
      </div>
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
