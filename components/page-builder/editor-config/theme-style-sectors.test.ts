import { describe, expect, it } from "vitest"

import { STYLE_SECTORS } from "./style-sectors"
import { SECTOR_GROUPS, THEME_STYLE_SECTORS } from "./theme-style-sectors"
import { STYLE_GROUPS } from "@/lib/theme/style-surfaces"

type Decl = { property?: string; extend?: string; detached?: boolean }

const declsOf = (id: string): Decl[] =>
  (THEME_STYLE_SECTORS.find((s) => s.id === id)?.properties ?? []).map(
    (d) => (typeof d === "string" ? { extend: d } : d) as Decl
  )

const nameOf = (d: Decl): string => d.property ?? d.extend ?? ""

describe("theme style sectors", () => {
  // Building the list calls `editorProperty`, which throws for a name the
  // editor doesn't declare — so simply importing it proves every control is
  // the page editor's, not a local reinvention.
  it("mirrors the editor's sectors, minus the per-instance ones", () => {
    const editorIds = STYLE_SECTORS.map((s) => s.id)
    const themeIds = THEME_STYLE_SECTORS.map((s) => s.id)
    expect(themeIds).toEqual(
      editorIds.filter((id) => id !== "size" && id !== "position")
    )
  })

  it("maps every sector to at least one theme group, and covers every group", () => {
    const covered = new Set<string>()
    for (const sector of THEME_STYLE_SECTORS) {
      const groups = SECTOR_GROUPS[String(sector.id)]
      expect(groups?.length, String(sector.id)).toBeGreaterThan(0)
      groups.forEach((g) => covered.add(g))
    }
    expect([...covered].sort()).toEqual([...STYLE_GROUPS].sort())
  })

  it("declares every sector with at least one property", () => {
    for (const sector of THEME_STYLE_SECTORS) {
      expect(sector.properties?.length, String(sector.id)).toBeGreaterThan(0)
    }
  })

  // These three compose to a shorthand by default, which the theme stores per
  // side / per facet and so could not read back.
  it("detaches the composites whose longhands the theme stores", () => {
    const byName = new Map(
      [...declsOf("spacing"), ...declsOf("border")].map((d) => [nameOf(d), d])
    )
    for (const name of ["margin", "padding", "border"]) {
      expect(byName.get(name)?.detached, name).toBe(true)
    }
    // `border-radius` composes to one declaration, which the theme keeps whole.
    expect(byName.get("border-radius")?.detached).toBeUndefined()
  })

  it("ungates the flex rows, which have no component to read display from", () => {
    const layout = declsOf("layout") as (Decl & {
      requires?: unknown
      requiresParent?: unknown
    })[]
    for (const name of ["justify-content", "align-items", "align-content"]) {
      const decl = layout.find((d) => nameOf(d) === name)
      expect(decl, name).toBeDefined()
      expect(decl?.requires).toBeUndefined()
    }
    const alignSelf = layout.find((d) => nameOf(d) === "align-self")
    expect(alignSelf).toBeDefined()
    expect(alignSelf?.requiresParent).toBeUndefined()
  })

  it("offers the flex child properties alongside the container ones", () => {
    const names = declsOf("layout").map(nameOf)
    expect(names).toEqual(
      expect.arrayContaining(["align-self", "order", "flex"])
    )
  })
})
