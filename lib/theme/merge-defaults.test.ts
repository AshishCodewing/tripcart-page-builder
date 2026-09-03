import { describe, expect, it } from "vitest"

import { mergeThemeOverDefaults } from "@/lib/theme/merge-defaults"
import type { Theme } from "@/lib/theme/schema"
import { defaultTheme } from "@/lib/tokens"

// A stored document saved before `elements.button` grew a border and
// `variations` — the shape an existing tenant row has today.
const stored: Theme = {
  version: 1,
  settings: {
    color: {
      palette: [{ slug: "primary", name: "Brand", value: "hsl(20 90% 50%)" }],
    },
  },
  styles: {
    elements: {
      button: {
        color: { text: "white", background: "var:preset|color|primary" },
        border: { radius: "0" },
      },
    },
  },
}

describe("mergeThemeOverDefaults", () => {
  it("fills in defaults the stored document never had", () => {
    const merged = mergeThemeOverDefaults(stored)
    const button = merged.styles?.elements?.button
    expect(button?.variations?.outline).toEqual(
      defaultTheme.styles?.elements?.button?.variations?.outline
    )
    expect(button?.border?.width).toBe(
      defaultTheme.styles?.elements?.button?.border?.width
    )
    expect(merged.styles?.elements?.link).toEqual(
      defaultTheme.styles?.elements?.link
    )
  })

  it("keeps stored values where both define a key", () => {
    const button = mergeThemeOverDefaults(stored).styles?.elements?.button
    expect(button?.color?.text).toBe("white")
    expect(button?.border?.radius).toBe("0")
  })

  it("replaces token arrays wholesale instead of concatenating", () => {
    const merged = mergeThemeOverDefaults(stored)
    expect(merged.settings.color?.palette).toEqual(
      stored.settings.color?.palette
    )
    // Untouched categories still come from the defaults.
    expect(merged.settings.typography).toEqual(defaultTheme.settings.typography)
  })

  it("does not mutate the defaults", () => {
    const before = structuredClone(defaultTheme)
    mergeThemeOverDefaults(stored)
    expect(defaultTheme).toEqual(before)
  })

  it("returns the defaults unchanged for an empty override", () => {
    expect(mergeThemeOverDefaults({} as Theme)).toEqual(defaultTheme)
  })
})
