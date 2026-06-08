// Build a stable React `key` and an HTML `id` for a component node.
// `key` is what React diffs against; `nodeId` is what we set as the DOM `id`
// attribute when the component carries one explicitly.

import type { ComponentNode } from "./parser"

export const getComponentId = (
  component: ComponentNode,
  parentId?: string,
  index?: number
): { key: string; nodeId: string | undefined } => {
  const { id, type } = component
  const nodeId = id || undefined
  let key: string

  if (id) {
    key = id
  } else if (parentId) {
    key = `${parentId}-${index ?? 0}`
  } else if (type === "head") {
    key = "gjs-head"
  } else if (parentId === "gjs-head") {
    key = `${parentId}-${index ?? 0}`
  } else {
    key = `gjs-${type}`
  }

  return { key, nodeId }
}
