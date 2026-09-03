import { describe, expect, it } from "vitest"

import { presetVarName, resolveStyleRef } from "@/lib/theme/compile"
import { cssVarToStyleRef } from "@/lib/theme/style-ref"
import { defaultTheme } from "@/lib/tokens"

describe("cssVarToStyleRef", () => {
  it("recovers a camelCase slug from its kebab-cased variable", () => {
    const css = `var(${presetVarName("color", "primaryForeground")})`
    expect(css).toBe("var(--tc--preset--color--primary-foreground)")
    expect(cssVarToStyleRef(css, defaultTheme)).toBe(
      "var:preset|color|primaryForeground"
    )
  })

  it("handles a hyphenated category and a hyphenated slug together", () => {
    const ref = "var:preset|font-size|xxx-large"
    expect(cssVarToStyleRef(resolveStyleRef(ref), defaultTheme)).toBe(ref)
  })

  it("round-trips every color token in the default theme", () => {
    for (const token of defaultTheme.settings.color?.palette ?? []) {
      const ref = `var:preset|color|${token.slug}`
      expect(cssVarToStyleRef(resolveStyleRef(ref), defaultTheme)).toBe(ref)
    }
  })

  it("passes raw values and unknown variables through unchanged", () => {
    expect(cssVarToStyleRef("#ff0000", defaultTheme)).toBe("#ff0000")
    expect(cssVarToStyleRef("1.5rem", defaultTheme)).toBe("1.5rem")
    expect(cssVarToStyleRef("var(--size-3)", defaultTheme)).toBe(
      "var(--size-3)"
    )
    expect(
      cssVarToStyleRef("var(--tc--preset--color--nope)", defaultTheme)
    ).toBe("var(--tc--preset--color--nope)")
  })
})
