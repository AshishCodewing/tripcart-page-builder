import type { Component, Editor } from "grapesjs"

/**
 * A resolved drop: put `source` inside `parent`, in front of `before` (or last
 * when `before` is null).
 */
export type LayerDrop = {
  parent: Component
  before: Component | null
}

/**
 * Position for `Component.move()`, in the parent's *raw* child collection.
 *
 * The rows we render come from `Layers.getComponents()`, which filters out
 * non-`layerable` components (template-ref preview children set that flag), so
 * a visual index is not a collection index. Resolving through the reference
 * sibling instead of counting rows sidesteps that mismatch entirely, and yields
 * the pre-removal index `move()` expects: `move()` applies its own `at - 1`
 * shift when the source is an earlier child of the same parent.
 */
export function resolveDropIndex(
  parent: Component,
  before: Component | null
): number {
  const children = parent.components().models
  if (!before) return children.length
  const at = children.indexOf(before)
  return at < 0 ? children.length : at
}

/**
 * Whether GrapesJS would accept this drop. `canMove` is the single oracle for
 * `draggable`/`droppable` in all three of their forms (boolean, CSS selector,
 * predicate function) and it also rejects dropping a component into its own
 * descendant. Called on every projection change so an impossible target reads
 * as invalid mid-drag, not as a silent no-op on release.
 */
export function canDropLayer(
  editor: Editor,
  source: Component,
  drop: LayerDrop
): boolean {
  const at = resolveDropIndex(drop.parent, drop.before)
  return editor.Components.canMove(drop.parent, source, at).result
}

/** Returns false when GrapesJS rejects the move; nothing is mutated then. */
export function moveLayer(
  editor: Editor,
  source: Component,
  drop: LayerDrop
): boolean {
  const at = resolveDropIndex(drop.parent, drop.before)
  if (!editor.Components.canMove(drop.parent, source, at).result) return false

  editor.UndoManager.start()
  source.move(drop.parent, { at })
  editor.UndoManager.stop()
  return true
}
