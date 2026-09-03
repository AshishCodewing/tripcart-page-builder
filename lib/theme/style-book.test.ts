import { describe, expect, it } from "vitest"

import {
  ELEMENT_BUTTON_CLASS,
  variationClass,
} from "@/lib/theme/style-selectors"
import {
  findSpecimen,
  getStyleBookEntry,
  SPECIMEN_ATTR,
  specimenIdFor,
  STYLE_BOOK_ENTRIES,
  styleBookHtml,
} from "@/lib/theme/style-book"
import { getStyleSurface } from "@/lib/theme/style-surfaces"
import { defaultTheme } from "@/lib/tokens"

describe("style book registry", () => {
  it("uses unique entry and specimen ids", () => {
    const entryIds = STYLE_BOOK_ENTRIES.map((e) => e.id)
    const specimenIds = STYLE_BOOK_ENTRIES.flatMap((e) =>
      e.specimens.map((s) => s.id)
    )
    expect(new Set(entryIds).size).toBe(entryIds.length)
    expect(new Set(specimenIds).size).toBe(specimenIds.length)
  })

  it("gives every entry at least one specimen", () => {
    for (const entry of STYLE_BOOK_ENTRIES) {
      expect(entry.specimens.length, entry.id).toBeGreaterThan(0)
    }
  })

  it("only lists component entries that have a registered style surface", () => {
    for (const entry of STYLE_BOOK_ENTRIES) {
      if (entry.kind !== "component") continue
      expect(getStyleSurface(entry.type), entry.type).toBeDefined()
    }
  })

  it("only lists element variations the default theme defines", () => {
    for (const entry of STYLE_BOOK_ENTRIES) {
      if (entry.kind !== "element") continue
      const variations =
        defaultTheme.styles?.elements?.[entry.name]?.variations ?? {}
      for (const { slug } of entry.variations) {
        if (!slug) continue
        expect(variations[slug], `${entry.id}.${slug}`).toBeDefined()
      }
    }
  })

  it("ships specimen markup that matches what a dropped block produces", () => {
    const fill = findSpecimen("button-fill")!.specimen
    const outline = findSpecimen("button-outline")!.specimen
    expect(fill.html).toContain(ELEMENT_BUTTON_CLASS)
    expect(fill.html).not.toContain("is-style-")
    expect(outline.html).toContain(variationClass("outline"))
    expect(findSpecimen("tabs")!.specimen.html).toContain("<tc-tabs>")
  })
})

describe("styleBookHtml", () => {
  const html = styleBookHtml()

  it("emits one tagged section per specimen", () => {
    const count = html.split(`${SPECIMEN_ATTR}="`).length - 1
    const expected = STYLE_BOOK_ENTRIES.reduce(
      (sum, entry) => sum + entry.specimens.length,
      0
    )
    expect(count).toBe(expected)
    expect(html).toContain(`${SPECIMEN_ATTR}="button-outline"`)
  })

  it("uses no heading tags, which the theme styles globally", () => {
    expect(html).not.toMatch(/<h[1-6][\s>]/)
  })
})

describe("lookups", () => {
  it("resolves entries and specimens by id", () => {
    expect(getStyleBookEntry("button")?.label).toBe("Button")
    expect(getStyleBookEntry("nope")).toBeUndefined()
    expect(getStyleBookEntry(null)).toBeUndefined()
    expect(findSpecimen("nope")).toBeUndefined()
    expect(findSpecimen("tabs")?.entry.id).toBe("tabs")
  })

  it("maps a selected variation to its specimen, falling back to the first", () => {
    const button = getStyleBookEntry("button")!
    expect(specimenIdFor(button, null)).toBe("button-fill")
    expect(specimenIdFor(button, "outline")).toBe("button-outline")
    expect(specimenIdFor(button, "ghost")).toBe("button-fill")
    expect(specimenIdFor(getStyleBookEntry("tabs")!, null)).toBe("tabs")
  })
})
