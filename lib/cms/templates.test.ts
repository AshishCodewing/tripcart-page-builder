import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: { template: { findMany: vi.fn() } },
}))

import { prisma } from "@/lib/prisma"
import {
  resolveLayoutChrome,
  resolvePageTree,
  slimTemplateProject,
} from "@/lib/cms/templates"
import type {
  ComponentDefinition,
  ProjectDefinition,
  Rule,
} from "@/lib/plugins/react-renderer/project/types"

const findMany = vi.mocked(prisma.template.findMany)

const project = (
  root: ComponentDefinition,
  styles: Rule[] = []
): ProjectDefinition => ({
  pages: [{ frames: [{ component: root }] }],
  styles,
})

const ref = (slug: string): ComponentDefinition => ({
  type: "template-ref",
  attributes: { "data-slug": slug },
})

/** Build a `findMany` impl keyed on `where.slug` from a fixture map. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockTemplates(fixtures: Record<string, { data: any }>): void {
  findMany.mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (async ({ where }: any) =>
      fixtures[where.slug] ? [fixtures[where.slug]] : []) as never
  )
}

beforeEach(() => {
  findMany.mockReset()
})

const TENANT = "tenant-1"

describe("resolvePageTree", () => {
  it("returns the same object reference when there are no refs", async () => {
    mockTemplates({})
    const input = project({ tagName: "section" })
    const result = await resolvePageTree(TENANT, input)
    expect(result).toBe(input)
    expect(findMany).not.toHaveBeenCalled()
  })

  it("returns data unchanged when there is no root component", async () => {
    const input: ProjectDefinition = { pages: [{ frames: [] }] }
    expect(await resolvePageTree(TENANT, input)).toBe(input)
  })

  it("replaces a single ref with its template component and appends template styles after page styles", async () => {
    const pageStyle: Rule = { selectors: [".page"] }
    const tplStyle: Rule = { selectors: [".card"] }
    mockTemplates({
      card: {
        data: { component: { tagName: "article" }, styles: [tplStyle] },
      },
    })
    const input = project({ tagName: "div", components: [ref("card")] }, [
      pageStyle,
    ])
    const result = await resolvePageTree(TENANT, input)

    const resolvedRoot = result.pages![0].frames![0].component!
    expect(resolvedRoot.components![0]).toEqual({ tagName: "article" })
    expect(result.styles).toEqual([pageStyle, tplStyle])
  })

  it("resolves sibling reuse of the same slug but appends its styles only once", async () => {
    const tplStyle: Rule = { selectors: [".card"] }
    mockTemplates({
      card: {
        data: { component: { tagName: "article" }, styles: [tplStyle] },
      },
    })
    const input = project({
      tagName: "div",
      components: [ref("card"), ref("card")],
    })
    const result = await resolvePageTree(TENANT, input)

    const kids = result.pages![0].frames![0].component!.components!
    expect(kids).toHaveLength(2)
    expect(kids[0]).toEqual({ tagName: "article" })
    expect(kids[1]).toEqual({ tagName: "article" })
    expect(result.styles).toEqual([tplStyle])
  })

  it("emits a cycle placeholder when a template references its own slug", async () => {
    mockTemplates({
      a: { data: { component: ref("a") } },
    })
    const input = project({ tagName: "div", components: [ref("a")] })
    const result = await resolvePageTree(TENANT, input)

    const inner = result.pages![0].frames![0].component!.components![0]
    expect(inner.attributes?.["data-template-placeholder"]).toBe("cycle:a")
  })

  it("emits missing / empty / missing-slug placeholders", async () => {
    mockTemplates({
      empty: { data: {} },
    })
    const input = project({
      tagName: "div",
      components: [ref("nope"), ref("empty"), { type: "template-ref" }],
    })
    const result = await resolvePageTree(TENANT, input)

    const kids = result.pages![0].frames![0].component!.components!
    expect(kids[0].attributes?.["data-template-placeholder"]).toBe(
      "missing:nope"
    )
    expect(kids[1].attributes?.["data-template-placeholder"]).toBe(
      "empty:empty"
    )
    expect(kids[2].attributes?.["data-template-placeholder"]).toBe(
      "missing-slug"
    )
  })

  it("resolves the legacy ProjectDefinition-shaped template body", async () => {
    mockTemplates({
      legacy: {
        data: { pages: [{ frames: [{ component: { tagName: "aside" } }] }] },
      },
    })
    const input = project({ tagName: "div", components: [ref("legacy")] })
    const result = await resolvePageTree(TENANT, input)

    const inner = result.pages![0].frames![0].component!.components![0]
    expect(inner).toEqual({ tagName: "aside" })
  })

  it("defangs a document-level wrapper template root into a div", async () => {
    mockTemplates({
      doc: {
        data: {
          component: { type: "wrapper", components: [{ tagName: "main" }] },
        },
      },
    })
    const input = project({ tagName: "div", components: [ref("doc")] })
    const result = await resolvePageTree(TENANT, input)

    const inner = result.pages![0].frames![0].component!.components![0]
    expect(inner.tagName).toBe("div")
    expect(inner.attributes?.["data-tc-template-root"]).toBe("true")
    expect(inner.components![0]).toEqual({ tagName: "main" })
  })

  it("emits a max-depth-exceeded placeholder for a deep template chain", async () => {
    // t0 → t1 → … → t17, each referencing the next. MAX_DEPTH = 16.
    const fixtures: Record<
      string,
      { data: { component: ComponentDefinition } }
    > = {}
    for (let i = 0; i < 17; i++) {
      fixtures[`t${i}`] = { data: { component: ref(`t${i + 1}`) } }
    }
    fixtures.t17 = { data: { component: { tagName: "span" } } }
    mockTemplates(fixtures)

    const input = project({ tagName: "div", components: [ref("t0")] })
    const result = await resolvePageTree(TENANT, input)

    const json = JSON.stringify(result)
    expect(json).toContain('"data-template-placeholder":"max-depth-exceeded"')
  })
})

describe("resolveLayoutChrome (Approach A)", () => {
  it("expands the layout's PART refs and leaves the content-slot in place", async () => {
    mockTemplates({
      standard: {
        data: {
          component: {
            tagName: "div",
            components: [
              ref("site-header"),
              { type: "content-slot" },
              ref("site-footer"),
            ],
          },
        },
      },
      "site-header": { data: { component: { tagName: "header" } } },
      "site-footer": { data: { component: { tagName: "footer" } } },
    })

    const result = await resolveLayoutChrome(TENANT, "standard")
    const root = result!.pages![0].frames![0].component!

    expect(root.components![0]).toEqual({ tagName: "header" })
    // The slot is NOT filled here — the render layer injects content via
    // config.slotContent. It must survive resolution untouched.
    expect(root.components![1]).toEqual({ type: "content-slot" })
    expect(root.components![2]).toEqual({ tagName: "footer" })
  })

  it("returns null when the layout slug is missing", async () => {
    mockTemplates({})
    expect(await resolveLayoutChrome(TENANT, "nope")).toBeNull()
  })

  it("returns null when the layout has no root component", async () => {
    mockTemplates({ empty: { data: {} } })
    expect(await resolveLayoutChrome(TENANT, "empty")).toBeNull()
  })

  it("merges the layout's own styles and its parts' styles", async () => {
    const layoutStyle: Rule = { selectors: [".layout"] }
    const headerStyle: Rule = { selectors: [".hdr"] }
    mockTemplates({
      standard: {
        data: {
          component: {
            tagName: "div",
            components: [ref("site-header"), { type: "content-slot" }],
          },
          styles: [layoutStyle],
        },
      },
      "site-header": {
        data: { component: { tagName: "header" }, styles: [headerStyle] },
      },
    })

    const result = await resolveLayoutChrome(TENANT, "standard")
    expect(result!.styles).toEqual([layoutStyle, headerStyle])
  })
})

describe("resolvePageTree — content-slot is inert (Approach A)", () => {
  it("passes a stray content-slot through untouched and hits no DB", async () => {
    mockTemplates({})
    const input = project({
      tagName: "div",
      components: [{ type: "content-slot" }],
    })
    const result = await resolvePageTree(TENANT, input)
    const root = result.pages![0].frames![0].component!

    expect(root.components![0]).toEqual({ type: "content-slot" })
    expect(findMany).not.toHaveBeenCalled()
  })
})

describe("slimTemplateProject", () => {
  it("extracts the root component and styles", () => {
    const root: ComponentDefinition = { tagName: "section" }
    const styles: Rule[] = [{ selectors: [".x"] }]
    expect(slimTemplateProject(project(root, styles))).toEqual({
      component: root,
      styles,
    })
  })

  it("defaults styles to [] when absent", () => {
    const root: ComponentDefinition = { tagName: "section" }
    expect(
      slimTemplateProject({ pages: [{ frames: [{ component: root }] }] })
    ).toEqual({ component: root, styles: [] })
  })

  it("throws when the payload has no root component", () => {
    expect(() => slimTemplateProject({})).toThrow(
      "Template payload missing a root component."
    )
    expect(() => slimTemplateProject({ pages: [{ frames: [] }] })).toThrow(
      "Template payload missing a root component."
    )
  })
})
