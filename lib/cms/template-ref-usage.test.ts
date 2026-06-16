import { describe, expect, it } from "vitest"

import {
  EMPTY_REF_USAGE,
  formatTemplateRefUsage,
  type TemplateRefUsage,
} from "./template-ref-usage"

const usage = (p: number, po: number, t: number): TemplateRefUsage => ({
  pages: p,
  posts: po,
  templates: t,
  total: p + po + t,
})

describe("formatTemplateRefUsage", () => {
  it("reports nothing for an unreferenced template", () => {
    expect(formatTemplateRefUsage(EMPTY_REF_USAGE)).toBe("no content")
  })

  it("singularizes a single reference", () => {
    expect(formatTemplateRefUsage(usage(1, 0, 0))).toBe("1 page")
    expect(formatTemplateRefUsage(usage(0, 1, 0))).toBe("1 post")
    expect(formatTemplateRefUsage(usage(0, 0, 1))).toBe("1 template")
  })

  it("pluralizes counts above one", () => {
    expect(formatTemplateRefUsage(usage(3, 0, 0))).toBe("3 pages")
  })

  it("joins two kinds with 'and'", () => {
    expect(formatTemplateRefUsage(usage(3, 1, 0))).toBe("3 pages and 1 post")
  })

  it("uses an Oxford comma for three kinds", () => {
    expect(formatTemplateRefUsage(usage(2, 1, 1))).toBe(
      "2 pages, 1 post, and 1 template"
    )
  })

  it("skips zero-count kinds", () => {
    expect(formatTemplateRefUsage(usage(0, 2, 1))).toBe(
      "2 posts and 1 template"
    )
  })
})
