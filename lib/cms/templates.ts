/**
 * Read-side CMS layer for Templates (layouts, patterns, parts).
 *
 * Mutations (create/update/delete, convert-from-selection) will live in
 * `template-actions.ts` once the editor UI surfaces are built. This
 * file is the read path: tenant-with-global-fallback lookup and the
 * recursive resolver used by the preview render path.
 *
 * See `docs/templates.md` for the design.
 */

import type { Template } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"

export async function getTemplateById(id: string) {
  return prisma.template.findUnique({ where: { id } })
}

/**
 * Resolve `(tenantId, slug)` → the matching Template's id. Used by the
 * `template-ref` toolbar "Edit" action to translate the slug stored on
 * the ref into the canonical id-based editor route.
 *
 *   - `tenantId = string` → tenant-first / global-fallback shadowing,
 *     same rule as `loadTemplate`.
 *   - `tenantId = null`   → globals only (skips tenant-scoped rows).
 *     Used when the surrounding content is itself a global template.
 */
export async function getTemplateIdBySlug(
  tenantId: string | null,
  slug: string
): Promise<string | null> {
  const where =
    tenantId === null
      ? { slug, tenantId: null }
      : { slug, OR: [{ tenantId }, { tenantId: null }] }
  const rows = await prisma.template.findMany({
    where,
    orderBy: { tenantId: { sort: "asc", nulls: "last" } },
    take: 1,
    select: { id: true },
  })
  return rows[0]?.id ?? null
}

/**
 * List all templates visible to a tenant — both tenant-scoped rows and
 * globals (tenantId IS NULL). Tenant rows are returned first so that
 * when a tenant has shadowed a global, the tenant's version surfaces in
 * the UI ahead of the global.
 */
export async function listTemplates(tenantId: string) {
  return prisma.template.findMany({
    where: { OR: [{ tenantId }, { tenantId: null }] },
    orderBy: [{ tenantId: { sort: "asc", nulls: "last" } }, { title: "asc" }],
  })
}

/**
 * Resolve a single Template by slug for a tenant. Tenant-scoped row
 * wins if it exists; the global row is the fallback. Returns null if
 * neither exists.
 *
 * One query, ordered so the tenant row sorts before the global, then
 * `take: 1`. This is the load-bearing read for `resolvePageTree`.
 */
export async function loadTemplate(
  tenantId: string,
  slug: string
): Promise<Template | null> {
  const rows = await prisma.template.findMany({
    where: { slug, OR: [{ tenantId }, { tenantId: null }] },
    orderBy: { tenantId: { sort: "asc", nulls: "last" } },
    take: 1,
  })
  return rows[0] ?? null
}

// --- Resolver ----------------------------------------------------------

const TEMPLATE_REF_TYPE = "template-ref"
const SLUG_ATTR = "data-slug"

/**
 * Max recursion depth — catches pathological nesting (deep fan-out
 * without an actual cycle, e.g. 50 levels of LAYOUT-containing-LAYOUT).
 * 16 is generous; real templates rarely nest past 3-4.
 */
const MAX_DEPTH = 16

/**
 * Minimal shape we touch on a GrapesJS component node. The rest of the
 * keys ride through untouched in the spread.
 */
type ComponentNode = {
  type?: string
  attributes?: Record<string, unknown>
  components?: ComponentNode[]
  [key: string]: unknown
}

/**
 * Walk a GrapesJS component tree and replace every `template-ref` node
 * with its resolved `Template.data`. Used by the preview render path
 * (and eventually the published renderer).
 *
 *   - Tenant-first / global fallback at each lookup (via loadTemplate).
 *   - Recursive: a resolved template can itself contain refs.
 *   - Cycle guard via a "currently resolving" slug stack — bails with
 *     a placeholder when the same slug reappears mid-chain. Sibling
 *     refs to the same template do NOT trip it (they're not a cycle,
 *     just reuse).
 *   - Per-resolution memoization: the same (tenant, slug) hits the DB
 *     once per call, even if referenced from many branches.
 */
export async function resolvePageTree(
  tenantId: string,
  tree: ComponentNode
): Promise<ComponentNode> {
  const cache = new Map<string, Template | null>()
  return resolveNode(tenantId, tree, cache, new Set(), 0)
}

async function resolveNode(
  tenantId: string,
  node: ComponentNode,
  cache: Map<string, Template | null>,
  visiting: Set<string>,
  depth: number
): Promise<ComponentNode> {
  if (depth > MAX_DEPTH) return placeholder("max-depth-exceeded")

  if (node.type === TEMPLATE_REF_TYPE) {
    const slug = String(node.attributes?.[SLUG_ATTR] ?? "")
    if (!slug) return placeholder("missing-slug")
    if (visiting.has(slug)) return placeholder(`cycle:${slug}`)

    let tpl = cache.get(slug)
    if (tpl === undefined) {
      tpl = await loadTemplate(tenantId, slug)
      cache.set(slug, tpl)
    }
    if (!tpl) return placeholder(`missing:${slug}`)

    visiting.add(slug)
    const resolved = await resolveNode(
      tenantId,
      tpl.data as ComponentNode,
      cache,
      visiting,
      depth + 1
    )
    visiting.delete(slug)
    return resolved
  }

  if (!Array.isArray(node.components) || node.components.length === 0) {
    return node
  }

  const resolvedChildren = await Promise.all(
    node.components.map((c) =>
      resolveNode(tenantId, c, cache, visiting, depth + 1)
    )
  )
  return { ...node, components: resolvedChildren }
}

/**
 * Emitted in place of a `template-ref` that couldn't be resolved
 * (missing template, cycle, depth limit). The renderer can detect it
 * via the `data-template-placeholder` attribute and choose to render
 * it visibly in dev / silently in prod.
 */
function placeholder(reason: string): ComponentNode {
  return {
    tagName: "div",
    attributes: { "data-template-placeholder": reason },
    components: [],
  }
}
