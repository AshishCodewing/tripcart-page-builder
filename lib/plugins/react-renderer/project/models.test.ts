import { describe, expect, it } from "vitest"

import {
  ComponentNode,
  findComponentById,
} from "@/lib/plugins/react-renderer/project/models"
import { getComponentId } from "@/lib/plugins/react-renderer/project/util"

describe("ComponentNode.tagName / type / isVoid", () => {
  it("maps known types to canonical tags", () => {
    const img = new ComponentNode({ type: "image" })
    expect(img.tagName).toBe("img")
    expect(img.isVoid).toBe(true)
    expect(new ComponentNode({ type: "wrapper" }).tagName).toBe("body")
    expect(new ComponentNode({ type: "link" }).tagName).toBe("a")
    expect(new ComponentNode({ type: "head" }).tagName).toBe("head")
  })

  it("falls back to persisted tagName and type 'default' when no type", () => {
    const n = new ComponentNode({ tagName: "section" })
    expect(n.tagName).toBe("section")
    expect(n.type).toBe("default")
  })

  it("returns an empty tagName for an empty node", () => {
    expect(new ComponentNode({}).tagName).toBe("")
  })
})

describe("ComponentNode.classes / attributes", () => {
  it("normalizes string and { name } classes and reflects them into attributes.class", () => {
    const n = new ComponentNode({ classes: ["a", { name: "b" }] })
    expect(n.classes).toEqual(["a", "b"])
    expect(n.attributes.class).toBe("a b")
  })

  it("reads id from attributes.id and ignores a top-level id", () => {
    const n = new ComponentNode({ id: "top", attributes: { id: "attr" } })
    expect(n.id).toBe("attr")
    expect(n.attributes.id).toBe("attr")
  })

  it("yields attributes.id === undefined when absent", () => {
    expect(new ComponentNode({}).attributes.id).toBeUndefined()
  })
})

describe("ComponentNode.head", () => {
  it("falls back to a bare <head> when no head is stored", () => {
    expect(new ComponentNode({}).head.tagName).toBe("head")
  })
})

describe("findComponentById", () => {
  const root = new ComponentNode({
    attributes: { id: "root" },
    components: [
      {
        attributes: { id: "child" },
        components: [{ attributes: { id: "leaf" } }],
      },
    ],
  })

  it("finds a nested node by attributes.id", () => {
    expect(findComponentById(root, "leaf")?.id).toBe("leaf")
  })

  it("returns null when the id is absent", () => {
    expect(findComponentById(root, "nope")).toBeNull()
  })
})

describe("getComponentId", () => {
  it("uses an explicit id for both key and nodeId", () => {
    const n = new ComponentNode({ attributes: { id: "x" } })
    expect(getComponentId(n)).toEqual({ key: "x", nodeId: "x" })
  })

  it("derives key from parentId + index when there is no id", () => {
    const n = new ComponentNode({})
    expect(getComponentId(n, "p", 2)).toEqual({ key: "p-2", nodeId: undefined })
  })

  it("uses gjs-head for a head node with no id or parent", () => {
    const n = new ComponentNode({ type: "head" })
    expect(getComponentId(n)).toEqual({ key: "gjs-head", nodeId: undefined })
  })

  it("falls back to gjs-<type> otherwise", () => {
    const n = new ComponentNode({ type: "foo" })
    expect(getComponentId(n)).toEqual({ key: "gjs-foo", nodeId: undefined })
  })
})
