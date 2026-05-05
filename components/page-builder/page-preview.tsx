// Server-rendered preview of a saved page.
//
// The project renderer's RenderProject + RenderPage emit a full <html>
// document, which is the right shape for a standalone publish deployment.
// Inside this Next.js app, however, the layout already provides <html> and
// <body>, so we render the wrapper component's children inline and inject
// the project CSS as a <style> block.

import {
  ProjectEditor,
  RenderComponent,
  type ProjectDefinition,
} from "@/lib/plugins/react-renderer/project"
import type { RendererReactOptions } from "@/lib/plugins/react-renderer"

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

  const editor = new ProjectEditor(projectData as ProjectDefinition)
  const css = editor.Css.getCssAsString()
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
