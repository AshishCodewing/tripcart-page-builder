// Render a complete page document: <html> wrapper, head (with inlined
// project CSS + optional headAfter slot), and body (root component tree
// + optional bodyAfter slot). The output is a self-contained tree suitable
// for SSR or for serializing to static HTML.

import { Fragment, type ElementType } from "react"
import { RenderComponent } from "./render-component"
import type { RenderPageProps } from "./types"

export const RenderPage = (props: RenderPageProps) => {
  const { config, root, css } = props
  const RootWrapper = config?.rootComponent || Fragment
  const HtmlTag: ElementType = (root.docEl?.tagName as ElementType) || "html"
  const HeadAfter = config?.headAfter || Fragment
  const BodyAfter = config?.bodyAfter || Fragment

  return (
    <HtmlTag>
      <RootWrapper>
        <RenderComponent component={root.head} config={config}>
          <style>{`${css}`}</style>
          <HeadAfter />
        </RenderComponent>
        <RenderComponent component={root} config={config}>
          <BodyAfter />
        </RenderComponent>
      </RootWrapper>
    </HtmlTag>
  )
}
