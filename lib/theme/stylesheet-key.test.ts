import { describe, expect, it } from "vitest"

import { mergeThemeOverDefaults } from "@/lib/theme/merge-defaults"
import type { Theme } from "@/lib/theme/schema"
import { themeStylesheetKey } from "@/lib/theme/stylesheet-key"
import { defaultTheme } from "@/lib/tokens"

describe("themeStylesheetKey", () => {
  it("is stable for the same theme and URL-safe", () => {
    const key = themeStylesheetKey(defaultTheme)
    expect(themeStylesheetKey(structuredClone(defaultTheme))).toBe(key)
    expect(key).toMatch(/^[0-9a-z]+$/)
  })

  it("changes when a tenant override changes the compiled CSS", () => {
    const stored: Theme = {
      version: 1,
      settings: {},
      styles: { elements: { button: { border: { radius: "0" } } } },
    }
    expect(themeStylesheetKey(mergeThemeOverDefaults(stored))).not.toBe(
      themeStylesheetKey(defaultTheme)
    )
  })

  it("changes when the defaults change underneath an unchanged tenant row", () => {
    const stored: Theme = { version: 1, settings: {} }
    const newerDefaults: Theme = {
      ...defaultTheme,
      styles: {
        ...defaultTheme.styles,
        elements: {
          ...defaultTheme.styles?.elements,
          cite: { typography: { fontStyle: "normal" } },
        },
      },
    }
    expect(themeStylesheetKey(mergeThemeOverDefaults(stored))).not.toBe(
      themeStylesheetKey(mergeThemeOverDefaults(stored, newerDefaults))
    )
  })
})
