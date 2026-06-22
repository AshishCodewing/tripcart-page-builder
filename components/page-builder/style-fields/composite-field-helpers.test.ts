import { describe, expect, it } from "vitest"
import type { PropertyComposite, PropertySelect } from "grapesjs"

import {
  extractSelectOptions,
  findSub,
  findSubBySide,
} from "./composite-field-helpers"

const sub = (name: string) => ({ getName: () => name })

// Minimal PropertyComposite stand-in: only the methods the helpers touch.
const composite = (name: string, subs: { getName: () => string }[]) =>
  ({
    getName: () => name,
    getProperties: () => subs,
  }) as unknown as PropertyComposite

describe("findSub", () => {
  it("returns the sub-property matching the name", () => {
    const target = sub("margin-top")
    const c = composite("margin", [sub("margin-left"), target])
    expect(findSub(c, "margin-top")).toBe(target)
  })

  it("returns undefined when nothing matches", () => {
    expect(findSub(composite("margin", []), "margin-top")).toBeUndefined()
  })
})

describe("findSubBySide", () => {
  it("composes the composite name with the side suffix", () => {
    const target = sub("padding-bottom")
    const c = composite("padding", [target])
    expect(findSubBySide(c, "bottom")).toBe(target)
  })
})

describe("extractSelectOptions", () => {
  it("maps options through getOptionId/getOptionLabel", () => {
    const first = {
      getOptions: () => ["a", "b"],
      getOptionId: (o: string) => o,
      getOptionLabel: (o: string) => o.toUpperCase(),
    } as unknown as PropertySelect
    expect(extractSelectOptions(first)).toEqual([
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ])
  })

  it("returns [] when the property has no getOptions", () => {
    expect(extractSelectOptions(undefined)).toEqual([])
  })
})
