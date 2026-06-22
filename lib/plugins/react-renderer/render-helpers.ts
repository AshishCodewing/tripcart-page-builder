// Pure helpers for RenderCanvasComponent (render-component.tsx). Kept separate
// so the tag-resolution precedence and child-merge filtering are testable
// without a live editor/canvas.

import type { ElementType, ReactNode } from "react"

// Resolve the element to render: a registered React component wins, then an
// explicit tagName prop, then the component's persisted tagName, then "div".
export const resolveComponentTag = (
  cfgComponent: ElementType | undefined,
  tagName: string | undefined,
  componentTagName: string | undefined
): ElementType | string => cfgComponent || tagName || componentTagName || "div"

// Combine rendered child nodes with any extra `children`, dropping nullish
// entries. Returns null (not an empty array) when nothing survives so callers
// can pass it straight to createElement. `childNodes` is loosely typed because
// GrapesJS' Components.map() returns `unknown[]`.
export const mergeRenderChildren = (
  childNodes: unknown[],
  children: ReactNode
): ReactNode => {
  const merged = [...childNodes, children].filter(
    (n) => n ?? false
  ) as ReactNode[]
  return merged.length ? merged : null
}
