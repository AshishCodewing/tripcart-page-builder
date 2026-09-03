// @vitest-environment jsdom
import grapesjs, { type Editor, type PropertySelect } from "grapesjs"
import { afterEach, describe, expect, it } from "vitest"

import { THEME_STYLE_SECTORS } from "./theme-style-sectors"
import { applyThemeTokenOptions } from "./theme-token-options"
import type { Theme } from "@/lib/theme/schema"

let editor: Editor | undefined

afterEach(() => {
  editor?.destroy()
  editor = undefined
})

const init = (): Editor => {
  editor = grapesjs.init({
    headless: true,
    storageManager: false,
    styleManager: { sectors: THEME_STYLE_SECTORS },
  })
  return editor
}

const optionIds = (ed: Editor, property: string): string[] => {
  const prop = ed.StyleManager.getProperty(
    "typography",
    property
  ) as PropertySelect
  return prop.getOptions().map((o) => String(prop.getOptionId(o)))
}

const themeWith = (families: string[], weights: string[]): Theme => ({
  version: 1,
  settings: {
    typography: {
      fontFamilies: families.map((slug) => ({
        slug,
        name: slug,
        value: "serif",
      })),
      fontWeights: weights.map((slug) => ({ slug, name: slug, value: "400" })),
    },
  },
})

describe("applyThemeTokenOptions", () => {
  it("puts theme tokens first and keeps the editor's own options", () => {
    const ed = init()
    const builtIns = optionIds(ed, "font-family")
    expect(builtIns.length).toBeGreaterThan(0)

    applyThemeTokenOptions(ed, themeWith(["heading", "body"], ["bold"]))

    const ids = optionIds(ed, "font-family")
    expect(ids.slice(0, 2)).toEqual([
      "var(--tc--preset--font-family--heading)",
      "var(--tc--preset--font-family--body)",
    ])
    expect(ids.slice(2)).toEqual(builtIns)
    expect(optionIds(ed, "font-weight")[0]).toBe(
      "var(--tc--preset--font-weight--bold)"
    )
  })

  it("re-fills rather than accumulating when the theme changes", () => {
    const ed = init()
    const builtIns = optionIds(ed, "font-family")

    applyThemeTokenOptions(ed, themeWith(["heading", "body"], []))
    applyThemeTokenOptions(ed, themeWith(["brand"], []))

    expect(optionIds(ed, "font-family")).toEqual([
      "var(--tc--preset--font-family--brand)",
      ...builtIns,
    ])
  })

  it("leaves the built-ins alone for a theme with no font tokens", () => {
    const ed = init()
    const builtIns = optionIds(ed, "font-family")
    applyThemeTokenOptions(ed, { version: 1, settings: {} })
    expect(optionIds(ed, "font-family")).toEqual(builtIns)
  })
})
