/**
 * Read-side CMS layer for Templates (layouts, patterns, parts).
 *
 * Mutations (create/update/delete, convert-from-selection) will live in
 * `template-actions.ts` once the editor UI surfaces are built. This
 * file is the read path: tenant-with-global-fallback lookup and the
 * recursive resolver used by the preview render path.
 *
 * See `docs/reference/templates.md` for the design.
 */

import type { Template, TemplateKind } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import type {
  ComponentDefinition,
  ProjectDefinition,
  Rule,
} from "@/lib/plugins/react-renderer/project/types"
import { unwrapTemplateRoot } from "@/lib/cms/template-shape"

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
 * Same visibility rule as `listTemplates` (tenant rows + globals,
 * tenant-first) but narrowed to a single `kind` — backs the Library
 * admin pages (Templates = LAYOUT, Patterns = PATTERN). Hits the
 * `@@index([tenantId, kind])`.
 */
export async function listTemplatesByKind(
  tenantId: string,
  kind: TemplateKind
) {
  return prisma.template.findMany({
    where: { kind, OR: [{ tenantId }, { tenantId: null }] },
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

/**
 * Does any persisted content reference `slug` via a `template-ref`?
 *
 * Backs the §4 slug-rename guard: renaming a template's slug silently
 * breaks every `{ type: "template-ref", attributes: { "data-slug": slug } }`
 * node pointing at it (refs live inside JSON columns, not FK-linked), so
 * we forbid the rename while any exist.
 *
 * Scans `pages`, `posts`, and `templates` (a LAYOUT can reference a PART
 * via the same node) with a single recursive JSONPath probe per table.
 * `$.** ? (@."data-slug" == $s)` matches any object at any depth carrying
 * the slug, so it's robust to arbitrary nesting; lax mode (the default)
 * swallows the structural mismatch on scalar members. Not tenant-scoped:
 * a global template's slug can be referenced from any tenant's content.
 */
export async function templateRefExists(slug: string): Promise<boolean> {
  const vars = JSON.stringify({ s: slug })
  const rows = await prisma.$queryRaw<{ found: boolean }[]>`
    SELECT (
      EXISTS (
        SELECT 1 FROM "pages"
        WHERE jsonb_path_exists("data", '$.** ? (@."data-slug" == $s)', ${vars}::jsonb)
      )
      OR EXISTS (
        SELECT 1 FROM "posts"
        WHERE jsonb_path_exists("data", '$.** ? (@."data-slug" == $s)', ${vars}::jsonb)
      )
      OR EXISTS (
        SELECT 1 FROM "templates"
        WHERE jsonb_path_exists("data", '$.** ? (@."data-slug" == $s)', ${vars}::jsonb)
      )
    ) AS "found"
  `
  return rows[0]?.found ?? false
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
 * Shape stored in `Template.data` after the §9 slim-shape refactor.
 *
 * A template is conceptually a component + its styles, not "a one-page
 * project that happens to be a template". Keeping the stored shape
 * matched to the intent removes the `pages[0].frames[0].component`
 * walk from every reader.
 *
 * The `pages` field is kept for backward-compat during the migration
 * transition window — older rows shaped as a full `ProjectDefinition`
 * still resolve correctly. TODO(§9): drop the `pages` fallback once
 * the migration has run everywhere.
 */
export type TemplateBody = {
  component?: ComponentDefinition
  styles?: Rule[]
  /** Legacy shape — see TODO above. */
  pages?: ProjectDefinition["pages"]
}

/**
 * Reduce a full editor `ProjectDefinition` down to the slim Template body
 * shape `{ component, styles }` (§9). Single source of truth for the
 * transform — shared by `saveTemplate` (publish) and `saveEditorDraft`
 * (autosave) so both write templates in the same shape.
 *
 * Throws when the project has no root component — callers parse the
 * editor payload first, so a missing root means a malformed submission.
 */
export function slimTemplateProject(project: unknown): {
  component: ComponentDefinition
  styles: Rule[]
} {
  const p = project as {
    pages?: Array<{ frames?: Array<{ component?: ComponentDefinition }> }>
    styles?: Rule[]
  }
  const component = p?.pages?.[0]?.frames?.[0]?.component
  if (!component) throw new Error("Template payload missing a root component.")
  return {
    component,
    styles: Array.isArray(p?.styles) ? p.styles : [],
  }
}

type ResolveCtx = {
  tenantId: string
  cache: Map<string, Template | null>
  visiting: Set<string>
  styles: Rule[]
  stylesAdded: Set<string>
}

/**
 * Walk a saved page/post `ProjectDefinition`, replacing every
 * `template-ref` component with its resolved Template content and
 * merging any template-scoped styles into the project's `styles[]`.
 * Used by the preview render path (and eventually the published
 * renderer).
 *
 *   - Tenant-first / global fallback at each lookup (via loadTemplate).
 *   - Recursive: a resolved template can itself contain refs.
 *   - Cycle guard via a "currently resolving" slug stack — bails with
 *     a placeholder when the same slug reappears mid-chain. Sibling
 *     refs to the same template do NOT trip it (they're reuse, not
 *     a cycle).
 *   - Per-resolution memoization of the DB lookup, plus per-slug
 *     style dedupe so a template referenced N times still contributes
 *     its `styles[]` once.
 *   - Template styles append AFTER page styles. For nested templates,
 *     the outer wrapper's styles append last so its rules win the
 *     cascade against any inner template they wrap.
 */
export async function resolvePageTree(
  tenantId: string,
  data: ProjectDefinition
): Promise<ProjectDefinition> {
  const firstPage = data?.pages?.[0]
  const firstFrame = firstPage?.frames?.[0]
  const root = firstFrame?.component
  if (!firstPage || !firstFrame || !root) return data

  const ctx: ResolveCtx = {
    tenantId,
    cache: new Map(),
    visiting: new Set(),
    styles: [],
    stylesAdded: new Set(),
  }
  const resolvedRoot = await resolveNode(ctx, root, 0)

  if (ctx.styles.length === 0 && resolvedRoot === root) return data

  return {
    ...data,
    pages: [
      {
        ...firstPage,
        frames: [
          { ...firstFrame, component: resolvedRoot },
          ...firstPage.frames!.slice(1),
        ],
      },
      ...data.pages!.slice(1),
    ],
    styles: [...(data.styles ?? []), ...ctx.styles],
  }
}

async function resolveNode(
  ctx: ResolveCtx,
  node: ComponentDefinition,
  depth: number
): Promise<ComponentDefinition> {
  if (depth > MAX_DEPTH) return placeholder("max-depth-exceeded")

  if (node.type === TEMPLATE_REF_TYPE) {
    const slug = String(node.attributes?.[SLUG_ATTR] ?? "")
    if (!slug) return placeholder("missing-slug")
    if (ctx.visiting.has(slug)) return placeholder(`cycle:${slug}`)

    let tpl = ctx.cache.get(slug)
    if (tpl === undefined) {
      tpl = await loadTemplate(ctx.tenantId, slug)
      ctx.cache.set(slug, tpl)
    }
    if (!tpl) return placeholder(`missing:${slug}`)

    // Slim shape first; fall back to the legacy ProjectDefinition shape
    // for rows that predate the §9 migration. Drop the fallback once
    // every environment has run the migration.
    const tplData = tpl.data as TemplateBody | null
    const rawRoot =
      tplData?.component ?? tplData?.pages?.[0]?.frames?.[0]?.component
    if (!rawRoot) return placeholder(`empty:${slug}`)
    // Defang a document-level root (`wrapper`/`body`) before splicing it
    // into the page — see template-shape.ts.
    const tplRoot = unwrapTemplateRoot(rawRoot)

    ctx.visiting.add(slug)
    const resolved = await resolveNode(ctx, tplRoot, depth + 1)
    ctx.visiting.delete(slug)

    if (!ctx.stylesAdded.has(slug)) {
      ctx.stylesAdded.add(slug)
      const tplStyles = tplData?.styles
      if (Array.isArray(tplStyles) && tplStyles.length > 0) {
        ctx.styles.push(...tplStyles)
      }
    }

    return resolved
  }

  if (!Array.isArray(node.components) || node.components.length === 0) {
    return node
  }

  const resolvedChildren = await Promise.all(
    node.components.map((c) => resolveNode(ctx, c, depth + 1))
  )
  return { ...node, components: resolvedChildren }
}

/**
 * Emitted in place of a `template-ref` that couldn't be resolved
 * (missing template, cycle, depth limit, empty data). The renderer
 * can detect it via the `data-template-placeholder` attribute and
 * choose to render it visibly in dev / silently in prod.
 */
function placeholder(reason: string): ComponentDefinition {
  return {
    tagName: "div",
    attributes: { "data-template-placeholder": reason },
    components: [],
  }
}
