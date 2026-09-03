import { describe, expect, it } from "vitest"

import {
  getStyleSurface,
  STYLE_GROUPS,
  STYLE_SURFACES,
} from "@/lib/theme/style-surfaces"

// Every declared surface must be usable by both the schema (validation)
// and the compiler (emission): unique types, real selectors, and no
// `:where()` — a zero-specificity theme rule could never beat the block's
// own structural defaults, so the declaration would silently do nothing.
describe("style surfaces", () => {
  it("registers each type once and resolves it by type", () => {
    const types = STYLE_SURFACES.map((s) => s.type)
    expect(new Set(types).size).toBe(types.length)
    for (const surface of STYLE_SURFACES) {
      expect(getStyleSurface(surface.type)).toBe(surface)
    }
    expect(getStyleSurface("nope")).toBeUndefined()
  })

  it("declares parts with real selectors and known style groups", () => {
    for (const surface of STYLE_SURFACES) {
      for (const part of [surface.root, ...Object.values(surface.parts)]) {
        expect(part.label.length).toBeGreaterThan(0)
        expect(part.selector.trim().length).toBeGreaterThan(0)
        expect(part.selector).not.toContain(":where(")
        for (const group of part.supports) {
          expect(STYLE_GROUPS).toContain(group)
        }
        expect(new Set(part.states).size).toBe(part.states.length)
      }
    }
  })

  it("tabs exposes the tab button with its selected state", () => {
    const tabs = getStyleSurface("tc-tabs")!
    expect(tabs.parts.tab.selector).toBe('tc-tabs [role="tab"]')
    expect(tabs.parts.tab.states).toContain('[aria-selected="true"]')
  })
})
