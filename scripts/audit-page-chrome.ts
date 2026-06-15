import "dotenv/config"

import { prisma } from "@/lib/prisma"

// Read-only audit of how existing pages encode their header/footer "chrome".
//
// Context: Approach A (docs/reference/templates-followups.md §14) makes a
// LAYOUT a persistent frame that wraps page content via a `content-slot`.
// Existing `Page.data` is DISPOSABLE — we are not migrating it, so this
// script writes nothing and decides no migration. Its only job is to tell us
// *how chrome is authored today* so the zone set + slot placement in the A
// design matches real usage:
//
//   - If pages already pull chrome in via `template-ref` PARTs (shared
//     header/footer templates), those PARTs map cleanly onto A's zone frames.
//   - If pages bake raw <header>/<footer> markup per page, there is no shared
//     chrome to lift into a zone — authors will rebuild chrome once in a
//     LAYOUT, which is fine given the data is disposable, but it tells us the
//     zone library starts empty.
//
// Run: `pnpm tsx scripts/audit-page-chrome.ts`  (DATABASE_URL from .env)

const TEMPLATE_REF_TYPE = "template-ref"
const SLUG_ATTR = "data-slug"
const CONTENT_SLOT_TYPE = "content-slot"

// Loose mirror of the serialized GrapesJS component shape (see
// lib/plugins/react-renderer/project/types.ts — deliberately tolerant).
type Node = {
  type?: string
  tagName?: string
  attributes?: Record<string, unknown>
  classes?: Array<string | { name?: string }>
  components?: Node[]
  content?: string
}

// A page row's `data` is either the full ProjectDefinition (pages/frames) or,
// defensively, already a slim `{ component }`. Reach the root component either
// way; null means "no renderable tree" (blank/seed page).
function rootOf(data: unknown): Node | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  if (d.component) return d.component as Node
  const pages = d.pages as Array<Record<string, unknown>> | undefined
  const frame = (pages?.[0]?.frames as Array<Record<string, unknown>>)?.[0]
  return (frame?.component as Node) ?? null
}

function classList(n: Node): string[] {
  return (n.classes ?? [])
    .map((c) => (typeof c === "string" ? c : c?.name))
    .filter((c): c is string => Boolean(c))
}

function walk(n: Node | null | undefined, fn: (n: Node) => void): void {
  if (!n) return
  fn(n)
  for (const c of n.components ?? []) walk(c, fn)
}

function refSlug(n: Node): string | null {
  if (n.type !== TEMPLATE_REF_TYPE) return null
  const slug = n.attributes?.[SLUG_ATTR]
  return typeof slug === "string" ? slug : null
}

// Heuristic chrome classifier for a single node — tag name first, then a
// class-name signal. Intentionally generous: this is a sketch of reality, not
// a migration parser.
function rawChromeKind(n: Node): "header" | "footer" | null {
  const tag = (n.tagName ?? "").toLowerCase()
  const cls = classList(n).join(" ").toLowerCase()
  if (tag === "header" || /\b(site-)?header\b|navbar|topbar/.test(cls)) {
    return "header"
  }
  if (tag === "footer" || /\b(site-)?footer\b/.test(cls)) return "footer"
  return null
}

type Encoding = "template-ref" | "raw-markup" | "mixed" | "none" | "empty"

type PageReport = {
  tenantId: string
  path: string
  encoding: Encoding
  topChildren: number
  refSlugs: string[]
  rawHeaders: number
  rawFooters: number
  navs: number
  hasContentSlot: boolean
}

async function main() {
  const pages = await prisma.page.findMany({
    select: { tenantId: true, path: true, data: true },
    orderBy: [{ tenantId: "asc" }, { path: "asc" }],
  })

  // Label referenced slugs with their template kind/area so the summary shows
  // which refs are actually PART chrome vs patterns/layouts.
  const templates = await prisma.template.findMany({
    select: { slug: true, kind: true, area: true },
  })
  const tplBySlug = new Map(templates.map((t) => [t.slug, t]))

  const reports: PageReport[] = []
  const slugFreq = new Map<string, number>()

  for (const page of pages) {
    const root = rootOf(page.data)
    if (!root) {
      reports.push({
        tenantId: page.tenantId,
        path: page.path,
        encoding: "empty",
        topChildren: 0,
        refSlugs: [],
        rawHeaders: 0,
        rawFooters: 0,
        navs: 0,
        hasContentSlot: false,
      })
      continue
    }

    let rawHeaders = 0
    let rawFooters = 0
    let navs = 0
    let hasContentSlot = false
    const refSlugs: string[] = []

    walk(root, (n) => {
      const slug = refSlug(n)
      if (slug) {
        refSlugs.push(slug)
        slugFreq.set(slug, (slugFreq.get(slug) ?? 0) + 1)
      }
      if (n.type === CONTENT_SLOT_TYPE) hasContentSlot = true
      const kind = rawChromeKind(n)
      if (kind === "header") rawHeaders++
      if (kind === "footer") rawFooters++
      if ((n.tagName ?? "").toLowerCase() === "nav") navs++
    })

    const hasRef = refSlugs.length > 0
    const hasRaw = rawHeaders + rawFooters > 0
    const encoding: Encoding = hasRef
      ? hasRaw
        ? "mixed"
        : "template-ref"
      : hasRaw
        ? "raw-markup"
        : "none"

    reports.push({
      tenantId: page.tenantId,
      path: page.path,
      encoding,
      topChildren: root.components?.length ?? 0,
      refSlugs,
      rawHeaders,
      rawFooters,
      navs,
      hasContentSlot,
    })
  }

  // ---- Output ----------------------------------------------------------
  const byEncoding = (e: Encoding) => reports.filter((r) => r.encoding === e)

  console.log(`\n=== Page chrome audit — ${reports.length} page(s) ===\n`)

  console.log("Per-page:")
  for (const r of reports) {
    const refs = r.refSlugs.length
      ? ` refs=[${r.refSlugs
          .map((s) => {
            const t = tplBySlug.get(s)
            return t
              ? `${s}(${t.kind}${t.area ? `/${t.area}` : ""})`
              : `${s}(?)`
          })
          .join(", ")}]`
      : ""
    const raw =
      r.rawHeaders + r.rawFooters + r.navs > 0
        ? ` raw[h=${r.rawHeaders} f=${r.rawFooters} nav=${r.navs}]`
        : ""
    const slot = r.hasContentSlot ? " HAS-content-slot" : ""
    console.log(
      `  [${r.encoding.padEnd(12)}] ${r.tenantId}:/${r.path}` +
        ` (top=${r.topChildren})${refs}${raw}${slot}`
    )
  }

  console.log("\nSummary by encoding:")
  const order: Encoding[] = [
    "template-ref",
    "raw-markup",
    "mixed",
    "none",
    "empty",
  ]
  for (const e of order) {
    console.log(`  ${e.padEnd(12)} ${byEncoding(e).length}`)
  }

  if (slugFreq.size) {
    console.log(
      "\nReferenced template slugs (candidate shared chrome / zones):"
    )
    const sorted = [...slugFreq.entries()].sort((a, b) => b[1] - a[1])
    for (const [slug, count] of sorted) {
      const t = tplBySlug.get(slug)
      const label = t
        ? `${t.kind}${t.area ? `/${t.area}` : ""}`
        : "MISSING (dangling ref)"
      console.log(`  ${String(count).padStart(4)}x  ${slug}  — ${label}`)
    }
  }

  // ---- The decision input ---------------------------------------------
  const cleanlyShared = byEncoding("template-ref").length
  const rawOrMixed =
    byEncoding("raw-markup").length + byEncoding("mixed").length
  console.log("\nTakeaway for the Approach-A zone design:")
  console.log(
    `  ${cleanlyShared} page(s) already pull chrome via template-ref PARTs` +
      ` → those slugs map onto zone frames.`
  )
  console.log(
    `  ${rawOrMixed} page(s) bake raw header/footer markup` +
      ` → no shared chrome to lift; the zone library starts (partly) empty.`
  )
  console.log(
    "  (Data is disposable — this informs the zone set, not a migration.)\n"
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
