import { describe, expect, it } from "vitest"

import {
  ELEMENT_BUTTON_CLASS,
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

describe("compileTheme element rules", () => {
  const elementsTheme: Theme = {
    ...theme,
    styles: {
      elements: {
        heading: { ":hover": { color: { text: "red" } } },
        button: {
          color: { background: "var:preset|color|primary" },
          ":hover": { color: { background: "blue" } },
          variations: {
            outline: {
              color: { background: "transparent" },
              ":hover": { color: { text: "blue" } },
            },
          },
        },
      },
    },
  }

  it("targets only the .tc-element-button badge, never the bare button tag", () => {
    const { rules } = compileTheme(elementsTheme)
    const base = rules.find((r) => r.selector === `.${ELEMENT_BUTTON_CLASS}`)
    expect(base?.style).toEqual({
      "background-color": `var(${presetVarName("color", "primary")})`,
    })
    for (const { selector } of rules) {
      expect(selector).not.toMatch(/(^|,\s*)button\b/)
    }
  })

  it("suffixes pseudo states onto every selector in the list", () => {
    const selectors = compileTheme(elementsTheme).rules.map((r) => r.selector)
    expect(selectors).toContain(
      "h1:hover, h2:hover, h3:hover, h4:hover, h5:hover, h6:hover"
    )
    expect(selectors).toContain(`.${ELEMENT_BUTTON_CLASS}:hover`)
  })

  it("emits each variation as an is-style-<slug> rule set after the base", () => {
    const selectors = compileTheme(elementsTheme).rules.map((r) => r.selector)
    const base = selectors.indexOf(`.${ELEMENT_BUTTON_CLASS}`)
    const outline = selectors.indexOf(
      `.${ELEMENT_BUTTON_CLASS}.is-style-outline`
    )
    expect(base).toBeGreaterThanOrEqual(0)
    expect(outline).toBeGreaterThan(base)
    expect(selectors).toContain(
      `.${ELEMENT_BUTTON_CLASS}.is-style-outline:hover`
    )
  })

  it("keeps raw values like transparent in a variation", () => {
    const { rules } = compileTheme(elementsTheme)
    const outline = rules.find((r) => r.selector.endsWith(".is-style-outline"))
    expect(outline?.style).toEqual({ "background-color": "transparent" })
  })
})

describe("compileTheme component rules", () => {
  const componentsTheme: Theme = {
    ...theme,
    styles: {
      components: {
        "tc-tabs": {
          border: { color: "var:preset|color|primary" },
          parts: {
            tab: {
              typography: { fontWeight: "600" },
              states: {
                ":hover": { color: { text: "red" } },
                '[aria-selected="true"]': {
                  color: { text: "var:preset|color|primary" },
                },
              },
            },
          },
        },
        "tc-retired-block": { color: { text: "red" } },
      },
    },
  }

  it("emits root declarations on the surface's root selector", () => {
    const { rules } = compileTheme(componentsTheme)
    expect(rules).toContainEqual({
      selector: "tc-tabs",
      style: { "border-color": `var(${presetVarName("color", "primary")})` },
    })
  })

  it("emits each part on its declared selector, states as suffixes", () => {
    const { rules } = compileTheme(componentsTheme)
    expect(rules).toContainEqual({
      selector: 'tc-tabs [role="tab"]',
      style: { "font-weight": "600" },
    })
    expect(rules).toContainEqual({
      selector: 'tc-tabs [role="tab"]:hover',
      style: { color: "red" },
    })
    expect(rules).toContainEqual({
      selector: 'tc-tabs [role="tab"][aria-selected="true"]',
      style: { color: `var(${presetVarName("color", "primary")})` },
    })
  })

  it("emits nothing for a type with no registered surface", () => {
    const selectors = compileTheme(componentsTheme).rules.map((r) => r.selector)
    expect(selectors.some((s) => s.includes("tc-retired-block"))).toBe(false)
    expect(selectors.some((s) => s.includes("data-gjs-type"))).toBe(false)
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
