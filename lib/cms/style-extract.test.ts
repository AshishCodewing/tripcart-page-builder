import { describe, expect, it } from "vitest"

import type {
  ComponentDefinition,
  Rule,
} from "@/lib/plugins/react-renderer/project/types"
import {
  collectComponentIdentity,
  collectStyledIds,
  extractStylesForSubtree,
  remapStyleIds,
} from "@/lib/cms/style-extract"

describe("collectComponentIdentity", () => {
  it("collects ids and classes from a nested tree across all shapes", () => {
    const tree: ComponentDefinition = {
      id: "top-id",
      classes: ["a", { name: "b" }],
      attributes: { id: "attr-id", class: "c d" },
      components: [
        {
          id: "child-id",
          classes: ["e"],
          attributes: { class: "f" },
        },
      ],
    }
    const { ids, classes } = collectComponentIdentity(tree)
    expect([...ids].sort()).toEqual(["attr-id", "child-id", "top-id"])
    expect([...classes].sort()).toEqual(["a", "b", "c", "d", "e", "f"])
  })

  it("returns an empty identity for undefined input", () => {
    const { ids, classes } = collectComponentIdentity(undefined)
    expect(ids.size).toBe(0)
    expect(classes.size).toBe(0)
  })
})

describe("extractStylesForSubtree", () => {
  const subtree: ComponentDefinition = {
    attributes: { id: "my-id", class: "my-class" },
  }

  it("matches a bare class-name string selector", () => {
    const rules: Rule[] = [{ selectors: ["my-class"] }]
    expect(extractStylesForSubtree(rules, subtree)).toEqual(rules)
  })

  it("matches prefixed string selectors (#id and .class)", () => {
    const idRule: Rule = { selectors: ["#my-id"] }
    const classRule: Rule = { selectors: [".my-class"] }
    expect(extractStylesForSubtree([idRule], subtree)).toEqual([idRule])
    expect(extractStylesForSubtree([classRule], subtree)).toEqual([classRule])
  })

  it("matches object selectors by type (2 = id, else class)", () => {
    const idSel = { selectors: [{ name: "my-id", type: 2 }] } as unknown as Rule
    const classSel = {
      selectors: [{ name: "my-class", type: 1 }],
    } as unknown as Rule
    // An id-named object selector with type 1 should NOT match an id.
    const idAsClass = {
      selectors: [{ name: "my-id", type: 1 }],
    } as unknown as Rule
    expect(extractStylesForSubtree([idSel], subtree)).toEqual([idSel])
    expect(extractStylesForSubtree([classSel], subtree)).toEqual([classSel])
    expect(extractStylesForSubtree([idAsClass], subtree)).toEqual([])
  })

  it("matches via raw selectorsAdd tokens", () => {
    const rule = { selectorsAdd: "#my-id > .foo" } as unknown as Rule
    expect(extractStylesForSubtree([rule], subtree)).toEqual([rule])
  })

  it("excludes non-matching rules", () => {
    const rule: Rule = { selectors: ["#other-id", ".other-class"] }
    expect(extractStylesForSubtree([rule], subtree)).toEqual([])
  })

  it("returns [] when the subtree carries no ids/classes", () => {
    const bare: ComponentDefinition = { tagName: "div" }
    const rules: Rule[] = [{ selectors: [".anything"] }]
    expect(extractStylesForSubtree(rules, bare)).toEqual([])
  })

  it("returns [] for an empty style list", () => {
    expect(extractStylesForSubtree([], subtree)).toEqual([])
  })
})

describe("collectStyledIds", () => {
  it("collects id names across string, object, and selectorsAdd forms", () => {
    const styles = [
      { selectors: ["#a", ".not-an-id"] },
      {
        selectors: [
          { name: "b", type: 2 },
          { name: "c", type: 1 },
        ],
      },
      { selectorsAdd: "#d > #e .klass" },
    ] as unknown as Rule[]
    expect([...collectStyledIds(styles)].sort()).toEqual(["a", "b", "d", "e"])
  })
})

describe("remapStyleIds", () => {
  it("rewrites id selectors (string + object) and selectorsAdd without mutating inputs", () => {
    const styles = [
      { selectors: ["#old", ".keep-class"] },
      { selectors: [{ name: "old", type: 2 }] },
      { selectorsAdd: "#old .keep-class" },
    ] as unknown as Rule[]
    const snapshot = structuredClone(styles)
    const idMap = new Map([["old", "new"]])

    const out = remapStyleIds(styles, idMap)

    expect((out[0] as { selectors: unknown[] }).selectors).toEqual([
      "#new",
      ".keep-class",
    ])
    expect((out[1] as { selectors: unknown[] }).selectors).toEqual([
      { name: "new", type: 2 },
    ])
    expect((out[2] as { selectorsAdd: string }).selectorsAdd).toBe(
      "#new .keep-class"
    )
    // Inputs untouched.
    expect(styles).toEqual(snapshot)
  })

  it("returns the same array when the id map is empty", () => {
    const styles = [{ selectors: ["#old"] }] as unknown as Rule[]
    expect(remapStyleIds(styles, new Map())).toBe(styles)
  })
})
