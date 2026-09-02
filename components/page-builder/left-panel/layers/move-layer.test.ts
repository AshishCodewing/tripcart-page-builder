import { describe, expect, it, vi } from "vitest"
import type { Component, Editor } from "grapesjs"

import { canDropLayer, moveLayer, resolveDropIndex } from "./move-layer"

const child = (id: string) => ({ id }) as unknown as Component

const parentWith = (children: Component[]) =>
  ({ components: () => ({ models: children }) }) as unknown as Component

const editorWith = (result: boolean) => {
  const canMove = vi.fn(() => ({ result }))
  const start = vi.fn()
  const stop = vi.fn()
  return {
    editor: {
      Components: { canMove },
      UndoManager: { start, stop },
    } as unknown as Editor,
    canMove,
    start,
    stop,
  }
}

describe("resolveDropIndex", () => {
  it("uses the reference sibling's position in the raw collection", () => {
    // `hidden` is a `layerable: false` child — it has no row in the tree, so a
    // visual index of 1 would be wrong here; the reference sibling is not.
    const hidden = child("hidden")
    const target = child("card-b")
    const parent = parentWith([child("card-a"), hidden, target])

    expect(resolveDropIndex(parent, target)).toBe(2)
  })

  it("appends past the last child when there is no reference sibling", () => {
    const parent = parentWith([child("a"), child("b")])

    expect(resolveDropIndex(parent, null)).toBe(2)
  })

  it("appends when the reference sibling is no longer in the collection", () => {
    const parent = parentWith([child("a")])

    expect(resolveDropIndex(parent, child("stale"))).toBe(1)
  })
})

describe("moveLayer", () => {
  it("moves inside an undo transaction, passing the pre-removal index", () => {
    const source = { move: vi.fn() } as unknown as Component
    const before = child("card-b")
    const parent = parentWith([child("card-a"), before, child("card-c")])
    const { editor, canMove, start, stop } = editorWith(true)

    expect(moveLayer(editor, source, { parent, before })).toBe(true)

    expect(canMove).toHaveBeenCalledWith(parent, source, 1)
    // Not 0: `Component.move` applies its own `at - 1` shift when the source is
    // an earlier child of the same parent. Pre-adjusting here would double it.
    expect(source.move).toHaveBeenCalledWith(parent, { at: 1 })
    expect(start).toHaveBeenCalledOnce()
    expect(stop).toHaveBeenCalledOnce()
  })

  it("mutates nothing when GrapesJS rejects the drop", () => {
    const source = { move: vi.fn() } as unknown as Component
    const parent = parentWith([child("a")])
    const { editor, start } = editorWith(false)

    expect(moveLayer(editor, source, { parent, before: null })).toBe(false)
    expect(source.move).not.toHaveBeenCalled()
    expect(start).not.toHaveBeenCalled()
  })
})

describe("canDropLayer", () => {
  it("asks canMove at the index the drop would use", () => {
    const source = child("source")
    const before = child("b")
    const parent = parentWith([child("a"), before])
    const { editor, canMove } = editorWith(true)

    expect(canDropLayer(editor, source, { parent, before })).toBe(true)
    expect(canMove).toHaveBeenCalledWith(parent, source, 1)
  })
})
