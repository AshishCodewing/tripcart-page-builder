// Render a resolved project as an inline *fragment* — the wrapper/<body>
// node's children plus the project's CSS — rather than a full <html>
// document (that path is RenderProject/RenderPage). The wrapper's classes
// ride a transparent host <div> so we stay inside the host page's <body>.
//
// Shared by every surface that renders stored project JSON inline: the page
// preview (`PagePreview`) and the site header/footer chrome rendered in the
// preview layout.
//
// It is deliberately pure: it takes an already-prepared ProjectDefinition
// and makes no decisions about protected-style filtering or empty-state UI —
// callers own those (see PagePreview).

import { ProjectEditor } from "./parser"
import { RenderComponent } from "./render-component"
import type { ProjectDefinition, RenderCommonProps } from "./types"
import type { ReactNode } from "react"

export interface RenderProjectFragmentProps extends RenderCommonProps {
  projectData: ProjectDefinition
  // Attributes applied to the transparent host <div> (e.g. a marker the
  // caller keys off). Defaults to none.
  rootAttributes?: Record<string, string>
  // Seed for child node ids; keeps keys stable/distinct per surface.
  parentId?: string
  // Rendered when the project has no root component. Callers supply their
  // own empty-state UI; defaults to nothing.
  emptyFallback?: ReactNode
}

export function RenderProjectFragment({
  projectData,
  config,
  rootAttributes,
  parentId = "fragment",
  emptyFallback = null,
}: RenderProjectFragmentProps) {
  const editor = new ProjectEditor(projectData)
  const pageCss = editor.Css.getCssAsString()

  const root = editor.Pages.getAll()[0]?.frames[0]?.component
  if (!root) return emptyFallback

  const wrapperClasses = root.classes.join(" ")

  return (
    <>
      {pageCss.length > 0 && (
        <style dangerouslySetInnerHTML={{ __html: pageCss }} />
      )}
      <div className={wrapperClasses || undefined} {...rootAttributes}>
        {root.components.map((child, i) => (
          <RenderComponent
            key={`${child.id ?? "n"}-${i}`}
            component={child}
            config={config}
            parentId={parentId}
            index={i}
          />
        ))}
      </div>
    </>
  )
}
