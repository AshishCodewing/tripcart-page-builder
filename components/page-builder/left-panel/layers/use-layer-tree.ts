"use client"

import { useEffect, useMemo, useReducer } from "react"
import { useEditorMaybe } from "@grapesjs/react"
import type { Component, Editor } from "grapesjs"

/**
 * The events GrapesJS' own Layer Manager listens to, plus the selection and
 * hover pair. `layerManager: { custom: true }` means nothing else is watching
 * them on our behalf — see docs/custom-react-ui-gaps.md for why a provider
 * subscription is never enough on its own.
 */
const LAYER_EVENTS = [
  // LayerManager sets its root from a one-shot `load` listener, and this panel
  // mounts before that fires — so `load` is when the tree first has anything
  // to show. Without it, a panel that rendered early stays empty forever:
  // `layer:root` is emitted during `load` too, before this subscription
  // exists, and nothing re-emits it.
  "load",
  "layer:root",
  "layer:component",
  "component:update:open",
  "component:update:status",
  "component:update:locked",
  "component:update:custom-name",
  "component:update:components",
  "component:update:classes",
  "component:selected",
  "component:deselected",
  "component:hovered",
  "component:unhovered",
] as const

/** One rendered row. Flat, because tree drag-and-drop projects over a list. */
export type LayerRow = {
  id: string
  component: Component
  depth: number
  /** `null` for a direct child of the layer root. */
  parentId: string | null
  hasChildren: boolean
  open: boolean
  visible: boolean
  locked: boolean
  selected: boolean
  name: string
}

export type LayerTree = {
  editor: Editor | undefined
  rows: LayerRow[]
  /** Row id → component, for turning a projection back into a drop target. */
  componentById: Map<string, Component>
  /** The wrapper. A row's `parentId` of `null` means "child of this". */
  root: Component | undefined
}

export function useLayerTree(): LayerTree {
  const editor = useEditorMaybe()
  const [version, bump] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    if (!editor) return

    // A single edit fans out into several of these events; coalesce a burst
    // into one re-render. The panel stays mounted for the whole session
    // (left-panel.tsx toggles visibility, not mounting), so this runs even
    // while the Blocks or Assistant tab is showing.
    let queued = false
    const refresh = () => {
      if (queued) return
      queued = true
      queueMicrotask(() => {
        queued = false
        bump()
      })
    }

    LAYER_EVENTS.forEach((event) => editor.on(event, refresh))
    return () => {
      LAYER_EVENTS.forEach((event) => editor.off(event, refresh))
    }
  }, [editor])

  const rows = useMemo(
    () => (editor ? flatten(editor) : []),
    // `version` is the subscription's way of invalidating this cache; the tree
    // itself lives in GrapesJS, not in React state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, version]
  )

  const componentById = useMemo(
    () => new Map(rows.map((row) => [row.id, row.component])),
    [rows]
  )

  return { editor, rows, componentById, root: editor?.Layers.getRoot() }
}

function flatten(editor: Editor): LayerRow[] {
  const layers = editor.Layers
  // `getRoot()` is empty until the editor's `load` event; the wrapper is what
  // it resolves to for our config (no `layerManager.root` selector is set), so
  // reading it directly makes the tree correct on the first render too.
  const root = layers.getRoot() ?? editor.getWrapper()
  if (!root) return []

  const rows: LayerRow[] = []

  const walk = (parent: Component, parentId: string | null, depth: number) => {
    // `getComponents` is the layerable-filtered child list — using
    // `parent.components()` here would surface the locked preview children
    // template-ref marks `layerable: false`.
    for (const component of layers.getComponents(parent)) {
      const data = layers.getLayerData(component)
      const id = component.getId()
      const hasChildren = data.components.length > 0

      rows.push({
        id,
        component,
        depth,
        parentId,
        hasChildren,
        open: data.open,
        visible: data.visible,
        locked: data.locked,
        selected: data.selected,
        name: data.name,
      })

      if (hasChildren && data.open) walk(component, id, depth + 1)
    }
  }

  // The wrapper itself gets no row — its children are the top level, the way
  // the canvas reads. `parentId: null` therefore means "child of the wrapper".
  walk(root, null, 0)
  return rows
}
