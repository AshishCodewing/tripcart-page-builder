// Top-level entry: pick a page (`pageId` or first), pick its first frame,
// then either render the whole page via RenderPage or, if `componentId`
// is given, render just that subtree wrapped in the user's rootComponent
// with the project CSS inlined.

import { Fragment } from "react"
import { ErrorType } from "../types"
import { ProjectEditor, findComponentById } from "./parser"
import { RenderComponent } from "./render-component"
import { RenderError } from "./render-error"
import { RenderPage } from "./render-page"
import type { RenderProjectProps } from "./types"

export const RenderProject = (props: RenderProjectProps) => {
  const { projectData, config = {}, pageId, componentId } = props

  const editor = new ProjectEditor(projectData)
  const css = editor.Css.getCssAsString()
  const pages = editor.Pages.getAll()

  if (!pages.length) {
    return <RenderError {...props} errorType={ErrorType.NoPagesFound} />
  }

  const page = pageId ? pages.find((p) => p.id === pageId) : pages[0]
  if (!page) {
    return <RenderError {...props} errorType={ErrorType.PageNotFound} />
  }

  const { frames } = page
  if (!frames.length) {
    return <RenderError {...props} errorType={ErrorType.NoFramesFound} />
  }

  const root = frames[0]?.component
  if (!root) {
    return <RenderError {...props} errorType={ErrorType.MissingRootComponent} />
  }

  if (componentId) {
    const target = findComponentById(root, componentId)
    if (!target) {
      return <RenderError {...props} errorType={ErrorType.ComponentNotFound} />
    }
    const RootWrapper = config.rootComponent || Fragment
    return (
      <RootWrapper>
        <style>{`${css}`}</style>
        <RenderComponent component={target} config={config} />
      </RootWrapper>
    )
  }

  return <RenderPage config={config} root={root} css={css} />
}

export default RenderProject
