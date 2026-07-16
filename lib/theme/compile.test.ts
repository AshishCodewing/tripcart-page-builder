import { describe, expect, it } from "vitest"

import {
  compileTheme,
  compiledThemeToCss,
  presetVarName,
  resolveStyleRef,
} from "@/lib/theme/compile"
import type { Theme } from "@/lib/theme/schema"

const theme: Theme = {
  version: 1,
  settings: {
    color: {
      palette: [
        { slug: "primary", name: "Primary", value: "hsl(220 90% 56%)" },
      ],
    },
  },
}

const darkTheme: Theme = {
  version: 1,
  settings: {
    color: {
      palette: [
        {
          slug: "background",
          name: "Background",
          value: "hsl(0 0% 100%)",
          dark: "hsl(0 0% 10%)",
        },
        // No `dark` — must stay fixed and never appear in darkVars.
        { slug: "primary", name: "Primary", value: "hsl(220 90% 56%)" },
      ],
    },
  },
}

describe("compileTheme", () => {
  it("emits a :root preset variable for each palette token", () => {
    const compiled = compileTheme(theme)
    expect(compiled.rootVars[presetVarName("color", "primary")]).toBe(
      "hsl(220 90% 56%)"
    )
    expect(compiled.rules).toEqual([])
  })

  it("leaves darkVars empty when no token has a dark value", () => {
    expect(compileTheme(theme).darkVars).toEqual({})
  })

  it("routes a token's dark value into darkVars, keyed by the same name", () => {
    const { rootVars, darkVars } = compileTheme(darkTheme)
    const bg = presetVarName("color", "background")
    expect(rootVars[bg]).toBe("hsl(0 0% 100%)")
    expect(darkVars[bg]).toBe("hsl(0 0% 10%)")
    // A token without `dark` is absent from darkVars entirely.
    expect(darkVars[presetVarName("color", "primary")]).toBeUndefined()
  })
})

describe("compiledThemeToCss", () => {
  it("renders the preset var name and value into a :root block", () => {
    const css = compiledThemeToCss(compileTheme(theme))
    expect(css).toContain(":root {")
    expect(css).toContain(
      `${presetVarName("color", "primary")}: hsl(220 90% 56%);`
    )
  })

  it("omits the dark media block and color-scheme for a light-only theme", () => {
    const css = compiledThemeToCss(compileTheme(theme))
    expect(css).not.toContain("prefers-color-scheme")
    expect(css).not.toContain("color-scheme")
  })

  it("emits a prefers-color-scheme block with color-scheme flips", () => {
    const css = compiledThemeToCss(compileTheme(darkTheme))
    const bg = presetVarName("color", "background")
    expect(css).toContain("@media (prefers-color-scheme: dark) {")
    expect(css).toContain(`${bg}: hsl(0 0% 10%);`)
    expect(css).toContain("color-scheme: light;")
    expect(css).toContain("color-scheme: dark;")
  })
})

describe("resolveStyleRef", () => {
  it("resolves a preset ref to a var() of the preset name", () => {
    expect(resolveStyleRef("var:preset|color|primary")).toBe(
      `var(${presetVarName("color", "primary")})`
    )
  })

  it("passes a raw CSS value through unchanged", () => {
    expect(resolveStyleRef("1rem")).toBe("1rem")
  })
})
