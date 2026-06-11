import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: { page: { findUnique: vi.fn() } },
}))

import { prisma } from "@/lib/prisma"
import {
  assertNotDescendant,
  buildPath,
  titleToSlug,
  validateSlug,
  validateTopLevelSlug,
} from "@/lib/cms/path"

const findUnique = vi.mocked(prisma.page.findUnique)

beforeEach(() => {
  findUnique.mockReset()
})

describe("validateSlug", () => {
  it("accepts a well-formed slug", () => {
    expect(() => validateSlug("about-us")).not.toThrow()
  })

  it("rejects uppercase, leading hyphen, double hyphen, and empty", () => {
    expect(() => validateSlug("About")).toThrow()
    expect(() => validateSlug("-x")).toThrow()
    expect(() => validateSlug("a--b")).toThrow()
    expect(() => validateSlug("")).toThrow()
  })
})

describe("titleToSlug", () => {
  it("lowercases, hyphenates runs of non-alphanumerics, trims hyphens", () => {
    expect(titleToSlug("Hello, World!")).toBe("hello-world")
  })

  it("returns an empty string for symbols-only input", () => {
    expect(titleToSlug("!!!")).toBe("")
  })
})

describe("validateTopLevelSlug", () => {
  it("rejects reserved top-level segments", () => {
    expect(() => validateTopLevelSlug("blog")).toThrow()
    expect(() => validateTopLevelSlug("admin")).toThrow()
  })

  it("allows a non-reserved segment", () => {
    expect(() => validateTopLevelSlug("about")).not.toThrow()
  })
})

describe("buildPath", () => {
  it("returns the slug unchanged for a top-level page, with no DB calls", async () => {
    expect(await buildPath("c", null)).toBe("c")
    expect(findUnique).not.toHaveBeenCalled()
  })

  it("walks parents to build a slash path with exactly one call per ancestor", async () => {
    const fixtures: Record<string, { slug: string; parentId: string | null }> =
      {
        idB: { slug: "b", parentId: "idA" },
        idA: { slug: "a", parentId: null },
      }
    findUnique.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (async ({ where }: any) => fixtures[where.id] ?? null) as never
    )
    expect(await buildPath("c", "idB")).toBe("a/b/c")
    expect(findUnique).toHaveBeenCalledTimes(2)
  })

  it("throws when a parent is missing", async () => {
    findUnique.mockImplementation((async () => null) as never)
    await expect(buildPath("c", "missing")).rejects.toThrow(
      "Parent missing not found."
    )
  })
})

describe("assertNotDescendant", () => {
  it("resolves immediately when the candidate parent is null", async () => {
    await expect(assertNotDescendant("p1", null)).resolves.toBeUndefined()
    expect(findUnique).not.toHaveBeenCalled()
  })

  it("throws when reparenting a page under itself", async () => {
    await expect(assertNotDescendant("p1", "p1")).rejects.toThrow(
      "A page cannot be its own ancestor."
    )
  })

  it("throws when the page appears mid-chain among the ancestors", async () => {
    const fixtures: Record<string, { parentId: string | null }> = {
      c: { parentId: "b" },
      b: { parentId: "p1" },
      p1: { parentId: "root" },
      root: { parentId: null },
    }
    findUnique.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (async ({ where }: any) => fixtures[where.id] ?? null) as never
    )
    await expect(assertNotDescendant("p1", "c")).rejects.toThrow(
      "A page cannot be its own ancestor."
    )
  })

  it("resolves when a chain ends at null without hitting the page", async () => {
    const fixtures: Record<string, { parentId: string | null }> = {
      c: { parentId: "b" },
      b: { parentId: null },
    }
    findUnique.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (async ({ where }: any) => fixtures[where.id] ?? null) as never
    )
    await expect(assertNotDescendant("p1", "c")).resolves.toBeUndefined()
  })

  it("(characterization) a parentId cycle that never reaches the page exits after MAX_DEPTH (32) calls without throwing", async () => {
    // self-referential parent → infinite chain, bounded only by MAX_DEPTH.
    findUnique.mockImplementation((async () => ({ parentId: "loop" })) as never)
    await expect(
      assertNotDescendant("not-in-chain", "loop")
    ).resolves.toBeUndefined()
    expect(findUnique).toHaveBeenCalledTimes(32)
  })
})
