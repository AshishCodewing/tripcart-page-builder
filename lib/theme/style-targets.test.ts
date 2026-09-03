import { describe, expect, it } from "vitest"

import { compileTheme } from "@/lib/theme/compile"
import type { Theme } from "@/lib/theme/schema"
import { ELEMENT_PSEUDO_KEYS } from "@/lib/theme/style-selectors"
import {
  entryPath,
  resetStyleBlock,
  setStyleValue,
  statesFor,
  supportsFor,
  targetPath,
  targetSelector,
  type StyleTarget,
} from "@/lib/theme/style-targets"
import { STYLE_GROUPS } from "@/lib/theme/style-surfaces"
import { defaultTheme } from "@/lib/tokens"

const bare: Theme = { version: 1, settings: {} }

describe("targetPath", () => {
  const cases: [string, StyleTarget, string[]][] = [
    [
      "element base",
      { kind: "element", name: "button" },
      ["styles", "elements", "button"],
    ],
    [
      "element pseudo",
      { kind: "element", name: "button", state: ":hover" },
      ["styles", "elements", "button", ":hover"],
    ],
    [
      "element variation",
      { kind: "element", name: "button", variation: "outline" },
      ["styles", "elements", "button", "variations", "outline"],
    ],
    [
      "element variation + pseudo",
      {
        kind: "element",
        name: "button",
        variation: "outline",
        state: ":hover",
      },
      ["styles", "elements", "button", "variations", "outline", ":hover"],
    ],
    [
      "component root",
      { kind: "component", type: "tc-tabs" },
      ["styles", "components", "tc-tabs"],
    ],
    [
      "component root state",
      { kind: "component", type: "tc-tabs", state: ":hover" },
      ["styles", "components", "tc-tabs", "states", ":hover"],
    ],
    [
      "component part",
      { kind: "component", type: "tc-tabs", part: "tab" },
      ["styles", "components", "tc-tabs", "parts", "tab"],
    ],
    [
      "component part state",
      {
        kind: "component",
        type: "tc-tabs",
        part: "tab",
        state: '[aria-selected="true"]',
      },
      [
        "styles",
        "components",
        "tc-tabs",
        "parts",
        "tab",
        "states",
        '[aria-selected="true"]',
      ],
    ],
  ]

  it.each(cases)("builds the path for %s", (_label, target, expected) => {
    expect(targetPath(target)).toEqual(expected)
  })
})

// The Blocks screen edits a theme rule by handing this selector to GrapesJS's
// StyleManager. If it ever diverged from what the compiler emits, the screen
// would silently edit a rule nothing renders — so pin them against each other
// by writing a value through the target and finding it in the compiled output.
describe("targetSelector matches the compiled rule", () => {
  const cases: [string, StyleTarget][] = [
    ["element base", { kind: "element", name: "button" }],
    ["element pseudo", { kind: "element", name: "button", state: ":hover" }],
    [
      "element variation",
      { kind: "element", name: "button", variation: "outline" },
    ],
    [
      "element variation + pseudo",
      {
        kind: "element",
        name: "button",
        variation: "outline",
        state: ":hover",
      },
    ],
    ["headings", { kind: "element", name: "heading" }],
    ["component root", { kind: "component", type: "tc-tabs" }],
    ["component part", { kind: "component", type: "tc-tabs", part: "tab" }],
    [
      "component part state",
      {
        kind: "component",
        type: "tc-tabs",
        part: "tab",
        state: '[aria-selected="true"]',
      },
    ],
  ]

  it.each(cases)("%s", (_label, target) => {
    const selector = targetSelector(target)
    expect(selector).toBeDefined()

    const theme = setStyleValue(bare, target, ["color", "text"], "red")
    const rule = compileTheme(theme).rules.find((r) => r.selector === selector)

    expect(rule, `no compiled rule for ${selector}`).toBeDefined()
    expect(rule?.style.color).toBe("red")
  })

  it("has no selector for a component with no registered surface", () => {
    expect(
      targetSelector({ kind: "component", type: "tc-nope" })
    ).toBeUndefined()
    expect(
      targetSelector({ kind: "component", type: "tc-tabs", part: "nope" })
    ).toBeUndefined()
  })
})

describe("setStyleValue", () => {
  it("builds the whole component tree on a theme with no styles", () => {
    const target: StyleTarget = {
      kind: "component",
      type: "tc-tabs",
      part: "tab",
      state: '[aria-selected="true"]',
    }
    const next = setStyleValue(bare, target, ["color", "text"], "red")
    expect(next.styles?.components?.["tc-tabs"]).toEqual({
      parts: {
        tab: {
          states: { '[aria-selected="true"]': { color: { text: "red" } } },
        },
      },
    })
  })

  it("keeps settings and sibling elements referentially identical", () => {
    const next = setStyleValue(
      defaultTheme,
      { kind: "element", name: "button" },
      ["color", "background"],
      "hotpink"
    )
    expect(next).not.toBe(defaultTheme)
    expect(next.settings).toBe(defaultTheme.settings)
    expect(next.styles?.elements?.link).toBe(
      defaultTheme.styles?.elements?.link
    )
  })

  it("returns the same theme for a no-op write", () => {
    const current = defaultTheme.styles?.elements?.button?.border?.radius
    expect(
      setStyleValue(
        defaultTheme,
        { kind: "element", name: "button" },
        ["border", "radius"],
        current
      )
    ).toBe(defaultTheme)
  })

  it("prunes an emptied component back out of the document", () => {
    const target: StyleTarget = {
      kind: "component",
      type: "tc-tabs",
      part: "tab",
    }
    const withValue = setStyleValue(bare, target, ["color", "text"], "red")
    const cleared = setStyleValue(
      withValue,
      target,
      ["color", "text"],
      undefined
    )
    expect(cleared.styles).toBeUndefined()
    expect(cleared.version).toBe(1)
  })
})

describe("resetStyleBlock", () => {
  it("resets the whole element, variations and states included", () => {
    const edited = [
      { kind: "element", name: "button", variation: "outline" } as const,
      { kind: "element", name: "button", state: ":hover" } as const,
    ].reduce<Theme>(
      (theme, target) =>
        setStyleValue(theme, target, ["color", "text"], "hotpink"),
      defaultTheme
    )
    // Any nesting of the button resolves to the same entry.
    expect(
      entryPath({
        kind: "element",
        name: "button",
        variation: "outline",
        state: ":hover",
      })
    ).toEqual(["styles", "elements", "button"])

    const reset = resetStyleBlock(
      edited,
      { kind: "element", name: "button", variation: "outline" },
      defaultTheme
    )
    expect(reset.styles?.elements?.button).toEqual(
      defaultTheme.styles?.elements?.button
    )
    // Neighbours keep their identity.
    expect(reset.styles?.elements?.link).toBe(edited.styles?.elements?.link)
    expect(reset.settings).toBe(edited.settings)
  })

  it("removes a component entry the defaults don't define", () => {
    const target: StyleTarget = {
      kind: "component",
      type: "tc-tabs",
      part: "tab",
    }
    const edited = setStyleValue(defaultTheme, target, ["color", "text"], "red")
    const reset = resetStyleBlock(edited, target, defaultTheme)
    expect(reset.styles?.components).toBeUndefined()
  })

  it("is a no-op when the block already matches the defaults", () => {
    expect(
      resetStyleBlock(
        defaultTheme,
        { kind: "element", name: "button" },
        defaultTheme
      )
    ).toBe(defaultTheme)
  })
})

describe("supportsFor / statesFor", () => {
  it("gives elements every group and the four pseudo states", () => {
    const target: StyleTarget = { kind: "element", name: "button" }
    expect(supportsFor(target)).toEqual(STYLE_GROUPS)
    expect(statesFor(target)).toEqual(ELEMENT_PSEUDO_KEYS)
  })

  it("offers every group on a part that doesn't narrow supports", () => {
    const tab: StyleTarget = { kind: "component", type: "tc-tabs", part: "tab" }
    expect(supportsFor(tab)).toEqual(STYLE_GROUPS)
    expect(statesFor(tab)).toContain('[aria-selected="true"]')

    const root: StyleTarget = { kind: "component", type: "tc-tabs" }
    expect(supportsFor(root)).toEqual(STYLE_GROUPS)
    expect(statesFor(root)).toEqual([])
  })

  it("returns nothing for a type with no surface or an unknown part", () => {
    expect(supportsFor({ kind: "component", type: "tc-nope" })).toEqual([])
    expect(
      statesFor({ kind: "component", type: "tc-tabs", part: "nope" })
    ).toEqual([])
  })
})
