// Render a resolved project as an inline *fragment* — the wrapper/<body>
// node's children plus the project's CSS — rather than a full <html>
// document (that path is RenderProject/RenderPage). We stay inside the host
// page's <body>, so the stored project's <body>/wrapper root is stripped.
//
// Shared by every surface that renders stored project JSON inline: the page
// preview (`PagePreview`) and the site header/footer chrome rendered in the
// preview layout.
//
// Two output shapes:
//   - default: the root's children go inside a host <div> that carries the
//     wrapper's classes (page-level/body styling set in the editor). Used for
//     page content.
//   - `bare`: no host <div> — the root's children render directly as a
//     fragment. Used for chrome, where the resolved root is a synthetic
//     wrapper and the real element (<header>/<footer>) should be top-level
//     rather than nested in an extra div.
//
// It is deliberately pure: it takes an already-prepared ProjectDefinition
// and makes no decisions about protected-style filtering or empty-state UI —
// callers own those (see PagePreview).

import { createElement, type ElementType, type ReactNode } from "react"
import { ProjectEditor } from "./parser"
import { RenderComponent } from "./render-component"
import type { ProjectDefinition, RenderCommonProps } from "./types"

export interface RenderProjectFragmentProps extends RenderCommonProps {
  projectData: ProjectDefinition
  // Seed for child node ids; keeps keys stable/distinct per surface.
  parentId?: string
  // Element for the host wrapper that carries the project root's classes.
  // Defaults to "div"; PagePreview passes "main" so page content is the
  // <main> landmark between the <header>/<footer> chrome. Ignored when `bare`.
  rootTag?: ElementType
  // Skip the host wrapper and render the root's children directly. For chrome
  // (header/footer) whose root is a synthetic wrapper — avoids a redundant
  // `<div><header>…</header></div>` nesting. Wrapper classes are dropped in
  // this mode (chrome roots carry none).
  bare?: boolean
  // Rendered when the project has no root component. Callers supply their
  // own empty-state UI; defaults to nothing.
  emptyFallback?: ReactNode
}

export function RenderProjectFragment({
  projectData,
  config,
  parentId = "fragment",
  rootTag = "div",
  bare = false,
  emptyFallback = null,
}: RenderProjectFragmentProps) {
  const editor = new ProjectEditor(projectData)
  const pageCss = editor.Css.getCssAsString()

  const root = editor.Pages.getAll()[0]?.frames[0]?.component
  if (!root) return emptyFallback

  const css =
    pageCss.length > 0 ? (
      <style dangerouslySetInnerHTML={{ __html: pageCss }} />
    ) : null

  const children = root.components.map((child, i) => (
    <RenderComponent
      key={`${child.id ?? "n"}-${i}`}
      component={child}
      config={config}
      parentId={parentId}
      index={i}
    />
  ))

  if (bare) {
    return (
      <>
        {css}
        {children}
      </>
    )
  }

  const wrapperClasses = root.classes.join(" ")
  return (
    <>
      {css}
      {createElement(
        rootTag,
        { className: wrapperClasses || undefined },
        children
      )}
    </>
  )
}
