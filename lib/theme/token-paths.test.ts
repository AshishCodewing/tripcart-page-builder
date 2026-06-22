import { describe, expect, it } from "vitest"

import { defaultTheme } from "@/lib/tokens"
import { getGroup, withGroup } from "@/lib/theme/token-paths"
import { mergePresetTokens } from "@/lib/theme/theme-mutations"
import type { Token } from "@/lib/theme/schema"

describe("token-paths get/set round-trip", () => {
  it("getGroup reads back what withGroup wrote", () => {
    const next: Token[] = [{ slug: "primary", value: "#f00" }]
    const updated = withGroup(defaultTheme, "color", next)
    expect(getGroup(updated, "color")).toEqual(next)
  })
})

describe("withGroup reference equality", () => {
  it("preserves untouched sibling branches by reference", () => {
    const updated = withGroup(defaultTheme, "color", [
      { slug: "primary", value: "#f00" },
    ])
    // Editing the color branch must not rebuild typography/spacing/etc — the
    // store relies on this so selectors over those branches don't re-fire.
    expect(updated.settings.typography).toBe(defaultTheme.settings.typography)
    expect(updated.settings.spacing).toBe(defaultTheme.settings.spacing)
    expect(updated.settings.border).toBe(defaultTheme.settings.border)
    // ...but it returns a new theme and a new color branch.
    expect(updated).not.toBe(defaultTheme)
    expect(updated.settings.color).not.toBe(defaultTheme.settings.color)
  })

  it("shares the color branch when a typography group is edited", () => {
    const updated = withGroup(defaultTheme, "font-size", [
      { slug: "base", value: "1rem" },
    ])
    expect(updated.settings.color).toBe(defaultTheme.settings.color)
    expect(updated.settings.typography).not.toBe(
      defaultTheme.settings.typography
    )
  })
})

describe("mergePresetTokens", () => {
  it("overrides matching slugs in place and appends new ones", () => {
    const existing: Token[] = [
      { slug: "a", value: "1" },
      { slug: "b", value: "2" },
    ]
    const preset = [
      { slug: "b", value: "20" },
      { slug: "c", value: "3" },
    ]
    expect(mergePresetTokens(existing, preset)).toEqual([
      { slug: "a", value: "1" },
      { slug: "b", value: "20" },
      { slug: "c", value: "3" },
    ])
  })
})
