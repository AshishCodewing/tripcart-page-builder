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

describe("compileTheme", () => {
  it("emits a :root preset variable for each palette token", () => {
    const compiled = compileTheme(theme)
    expect(compiled.rootVars[presetVarName("color", "primary")]).toBe(
      "hsl(220 90% 56%)"
    )
    expect(compiled.rules).toEqual([])
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
