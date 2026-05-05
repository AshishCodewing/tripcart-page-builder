// Recursive renderer for a saved-project component subtree. No editor,
// no view binding, no GrapesJS runtime — pure React from a JSON snapshot,
// safe to run during SSR.

import { createElement, type ElementType } from "react"
import { attrsToReactProps } from "../attrs"
import { getComponentId } from "./util"
import type { RenderComponentProps } from "./types"

export const RenderComponent = (props: RenderComponentProps) => {
  const { component, config, children, parentId, index } = props
  if (!component) return null

  const { type, content } = component

  // Text nodes serialize as plain strings; React renders them inline.
  if (type === "textnode") return content

  const cfgEntry = config?.components?.[type]
  const Tag = ((cfgEntry?.component as ElementType | undefined) ||
    component.tagName ||
    "div") as ElementType

  const { key, nodeId } = getComponentId(component, parentId, index)
  const isReactCmp = !!cfgEntry?.component

  const reactProps = attrsToReactProps(component.attributes) as Record<
    string,
    unknown
  >

  // For registered React components, coerce numeric-looking strings into
  // numbers so the component receives `width={123}` instead of `width="123"`.
  // We don't do this for raw HTML tags — React would forward the number to
  // the DOM attribute anyway, but the SDK matches strings to strings there.
  if (isReactCmp) {
    Object.keys(reactProps).forEach((k) => {
      const v = reactProps[k]
      if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) {
        reactProps[k] = Number(v)
      }
    })
  }

  const childCmps = component.components
  const childNodes = childCmps.length
    ? childCmps.map((child, i) => (
        <RenderComponent
          key={`${child.id ?? "n"}-${i}`}
          config={config}
          component={child}
          parentId={key}
          index={i}
        />
      ))
    : [content]

  const merged = [...childNodes, children]
  const finalProps = {
    ...reactProps,
    ...(nodeId ? { id: nodeId } : {}),
  }

  // React-component path uses the JSX runtime so children are passed via
  // props.children (which the consumer expects). Raw-tag path uses
  // createElement with `key` as the third hand-off so void elements can pass
  // `null` children explicitly.
  if (isReactCmp) {
    return (
      <Tag {...finalProps} key={key}>
        {merged}
      </Tag>
    )
  }
  return createElement(
    Tag,
    { ...finalProps, key },
    component.isVoid ? null : merged
  )
}
