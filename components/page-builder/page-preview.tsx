// Server-rendered preview of a saved page.
//
// The project renderer's RenderProject + RenderPage emit a full <html>
// document, which is the right shape for a standalone publish deployment.
// Inside this Next.js app, however, the layout already provides <html> and
// <body>, so we render the wrapper component's children inline and inject
// the project CSS as a <style> block.
//
// Tenant theme composition: `tc-local` strips every protected CssRule
// (the `:root` token vars and the body/element/component defaults) from
// `page.data` at save time so the tenant theme isn't duplicated into
// every page blob. The live editor canvas re-injects them via
// `designSystemPlugin`; this server-rendered surface composes them by
// receiving `tenantTheme` and emitting its compiled CSS BEFORE the
// per-page CSS, so the cascade resolves the same way.

import { filterProtectedStyles } from "@/lib/plugins/tc-storage-adapter"
import { compiledThemeToCss, compileTheme } from "@/lib/theme/compile"
import type { Theme } from "@/lib/theme/schema"
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
  // The tenant's brand theme. Compiled into a `:root` rule plus element
  // and component defaults, emitted above the per-page CSS so token
  // references like `var(--tc--preset--color--primary)` in user-authored
  // rules resolve. Omitted (e.g. on a tenant-less surface) falls back to
  // unresolved vars — the browser will use any provided fallbacks.
  tenantTheme?: Theme
  config?: RendererReactOptions
}

export function PagePreview({ projectData, tenantTheme, config }: Props) {
  if (!projectData || typeof projectData !== "object") {
    return <PreviewEmpty reason="No saved project data." />
  }

  // Strip protected (theme) rules from page data. The publish path now
  // filters these on the way out, but pages published before that
  // landed still carry a stale theme snapshot in `data.styles`; without
  // this defensive filter, the snapshot's `:root` rule would win the
  // cascade against the fresh `themeCss` below (same selector, same
  // specificity, page CSS comes later in source order).
  const filtered = filterProtectedStyles(projectData as ProjectData)
  const editor = new ProjectEditor(filtered as ProjectDefinition)
  const pageCss = editor.Css.getCssAsString()
  const themeCss = tenantTheme ? compiledThemeToCss(compileTheme(tenantTheme)) : ""
  // Theme CSS comes first — user-authored per-page rules win on
  // anything they specifically override (same source-order cascade the
  // editor canvas relies on).
  const css = [themeCss, pageCss].filter(Boolean).join("\n\n")

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
      <style dangerouslySetInnerHTML={{ __html: css }} />
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
