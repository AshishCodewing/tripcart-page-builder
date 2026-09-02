import { describe, expect, it } from "vitest"

import {
  excludeDescendants,
  projectDrop,
  type ProjectionRow,
} from "./drop-projection"

const INDENT = 14

// section
//   row
//     card-a
//     card-b
// footer
// aside
const rows: ProjectionRow[] = [
  { id: "section", depth: 0, parentId: null },
  { id: "row", depth: 1, parentId: "section" },
  { id: "card-a", depth: 2, parentId: "row" },
  { id: "card-b", depth: 2, parentId: "row" },
  { id: "footer", depth: 0, parentId: null },
  { id: "aside", depth: 0, parentId: null },
]

const project = (activeId: string, overId: string, offset: number) =>
  projectDrop({
    rows: excludeDescendants(rows, activeId),
    activeId,
    overId,
    dragOffsetLeft: offset,
    indentWidth: INDENT,
  })

describe("projectDrop", () => {
  it("reorders within the same parent without changing depth", () => {
    expect(project("card-b", "card-a", 0)).toEqual({
      parentId: "row",
      depth: 2,
      beforeId: "card-a",
    })
  })

  it("appends to the parent when no later sibling follows the drop point", () => {
    expect(project("card-a", "card-b", 0)).toEqual({
      parentId: "row",
      depth: 2,
      beforeId: null,
    })
  })

  it("reparents a top-level row into a nested list", () => {
    expect(project("aside", "card-b", INDENT * 2)).toEqual({
      parentId: "row",
      depth: 2,
      beforeId: "card-b",
    })
  })

  it("clamps depth to one level below the row above", () => {
    // Four indents of travel, but card-a only allows becoming its child.
    expect(project("footer", "card-b", INDENT * 4)?.depth).toBe(3)
  })

  it("clamps depth to the row below so the rows after it are not orphaned", () => {
    expect(project("footer", "card-b", -INDENT * 4)?.depth).toBe(2)
  })

  it("walks back to find the parent when dropping shallower than the row above", () => {
    // Out of `row` (depth 2) up to a sibling of `row` under `section`.
    expect(project("aside", "footer", INDENT)).toEqual({
      parentId: "section",
      depth: 1,
      beforeId: null,
    })
  })

  it("drops to the root when dragged fully left at the end of the list", () => {
    expect(project("card-b", "aside", -INDENT * 4)).toEqual({
      parentId: null,
      depth: 0,
      beforeId: null,
    })
  })

  it("returns null when the drop target is not in the list", () => {
    expect(project("card-a", "gone", 0)).toBeNull()
  })
})

describe("excludeDescendants", () => {
  it("removes the whole subtree but keeps the dragged row", () => {
    expect(excludeDescendants(rows, "section").map((r) => r.id)).toEqual([
      "section",
      "footer",
      "aside",
    ])
  })

  it("leaves the list untouched for a leaf", () => {
    expect(excludeDescendants(rows, "card-a")).toHaveLength(rows.length)
  })
})
