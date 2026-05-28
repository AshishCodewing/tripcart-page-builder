import { prisma } from "@/lib/prisma"

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Top-level segments owned by Next routes — editors can't claim them.
// "home" is implicitly reserved by the unique `path` constraint (only one
// row can have path = "home"), so it isn't listed here.
const RESERVED_TOP_SEGMENTS = new Set(["blog", "admin", "api", "_next"])

const MAX_DEPTH = 32

export function validateSlug(slug: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new Error(
      `Invalid slug "${slug}". Use lowercase letters, numbers, and hyphens only.`
    )
  }
}

/**
 * Derive a slug from a human-readable title. Lowercases, replaces every
 * run of non-alphanumeric characters with a single hyphen, and trims
 * leading/trailing hyphens. Used by the convert-to-template flow where
 * users only enter a title; the action then de-duplicates against the
 * tenant's existing template slugs.
 */
export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function validateTopLevelSlug(slug: string): void {
  if (RESERVED_TOP_SEGMENTS.has(slug)) {
    throw new Error(`"${slug}" is a reserved top-level segment.`)
  }
}

type ParentLookup = { slug: string; parentId: string | null } | null

export async function buildPath(
  slug: string,
  parentId: string | null
): Promise<string> {
  if (parentId === null) return slug
  const segments: string[] = [slug]
  let current: string | null = parentId
  for (let i = 0; i < MAX_DEPTH; i++) {
    if (!current) break
    const parent: ParentLookup = await prisma.page.findUnique({
      where: { id: current },
      select: { slug: true, parentId: true },
    })
    if (!parent) throw new Error(`Parent ${current} not found.`)
    segments.unshift(parent.slug)
    current = parent.parentId
  }
  return segments.join("/")
}

// A page cannot be reparented under itself or any of its descendants.
export async function assertNotDescendant(
  pageId: string,
  candidateParentId: string | null
): Promise<void> {
  if (!candidateParentId) return
  let current: string | null = candidateParentId
  for (let i = 0; i < MAX_DEPTH; i++) {
    if (!current) return
    if (current === pageId) {
      throw new Error("A page cannot be its own ancestor.")
    }
    const parent: { parentId: string | null } | null =
      await prisma.page.findUnique({
        where: { id: current },
        select: { parentId: true },
      })
    if (!parent) return
    current = parent.parentId
  }
}
