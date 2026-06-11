# Plan 009: Public render path — design spike (how published pages actually get served)

> **Executor instructions**: This is a DESIGN SPIKE — the deliverable is a
> design document, not code. You may not modify any source file; your only
> writable outputs are `docs/public-render-design.md` and the status row in
> `plans/README.md`. Investigate read-only, decide, document. If anything in
> the "STOP conditions" section occurs, stop and report.
>
> **Drift check (run first)**: `git diff --stat ae527df..HEAD -- app lib/cms components/page-builder`
> Drift is acceptable here — inventory current state, not the excerpts.

## Status

- **Priority**: P2 (direction — maintainer-selected)
- **Effort**: M (investigation + design doc)
- **Risk**: LOW (no code changes)
- **Depends on**: none (but read plan 008 — layout composition affects the render entry point)
- **Category**: direction
- **Planned at**: commit `ae527df`, 2026-06-11

## Why this matters

Pages and posts can be PUBLISHED, but **nothing serves them**. The only
rendering surface is the draft-mode-gated preview tree
(`app/preview/[tenantId]/...` — returns 404 unless draft mode is enabled);
the root route (`app/page.tsx`) is still the scaffold's "Project ready!"
placeholder; `Tenant.domain` is collected in the admin UI
(`app/admin/(shell)/tenants/page.tsx:41-42`) and stored unique in the schema
but **consumed nowhere**. A comment in
`app/preview/[tenantId]/[...slug]/page.tsx:10-11` says "Public rendering of
CMS pages happens in a separate deployment that consumes this DB" — that
deployment does not exist in this repo, and this spike must determine
whether it exists anywhere or is aspirational. This is the largest
stated-but-undelivered gap in the product: the entire publish lifecycle
(status, publishedAt, cache tags) currently feeds nothing.

## Current state (verified at planning time)

Pieces that already exist and want reuse:

- **Renderer**: `components/page-builder/page-preview.tsx` +
  `lib/plugins/react-renderer/project/` render a stored `ProjectDefinition`
  to React server-side (no GrapesJS at render). Pattern components come from
  `lib/plugins/patterns` (`patternComponents`).
- **Resolver**: `resolvePageTree` (and `resolvePageWithLayout` once plan 008
  lands) in `lib/cms/templates.ts`.
- **Theme**: per-tenant compiled CSS served at
  `app/api/preview/theme/[tenantId]/[version]/theme.css/route.ts` with
  immutable caching keyed on `Tenant.themeVersion`; the preview layout
  (`app/preview/[tenantId]/layout.tsx`) emits the `<link>`.
- **Cache invalidation scaffolding**: `lib/cms/cache-tags.ts` defines
  `page:<path>`, `post:<slug>`, `nav`, `tenant-theme:<id>`,
  `template:<slug>`; all mutation actions already call `updateTag(...)`.
  The comment on `cacheTags.template` says resolver caching "isn't wired
  yet — this is here so callers landing in the next iteration don't have to
  amend cache-tags too." The publish path is that iteration.
- **Tenancy**: `Tenant.slug` (unique) and `Tenant.domain` (unique,
  nullable); `Page` paths unique per tenant (`@@unique([tenantId, path])`).
- **Status gating**: `ContentStatus` DRAFT/PUBLISHED on Page/Post;
  `publishedAt` set on first publish.

## Commands you will need (read-only)

| Purpose | Command |
|---|---|
| Confirm no public routes | `find app -name "page.tsx" \| grep -v admin \| grep -v preview` |
| Domain consumption | `grep -rn "domain" app lib --include="*.ts" --include="*.tsx" \| grep -v node_modules` |
| Cache tag consumers | `grep -rn "cacheTags\|updateTag\|cacheTag\|cacheLife\|\"use cache\"" app lib --include="*.ts" --include="*.tsx"` |
| Status reads | `grep -rn "PUBLISHED" app lib --include="*.ts" --include="*.tsx"` |
| Vercel project linkage | `cat .vercel/project.json 2>/dev/null` (names the linked project) |

Also ask the operator one question before finalizing (record the answer in
the doc): **does a separate public-renderer deployment already exist
outside this repo?** The preview comment implies one; the design differs
radically if it's real.

## Scope

**In scope (writable)**: `docs/public-render-design.md`, `plans/README.md`.

**Out of scope**: ALL source files; any Vercel configuration changes; any
DNS/domain operations.

## Steps

### Step 1: Inventory

Run the commands above. Establish: no public route exists (or does);
nothing consumes `Tenant.domain` (or does); which cache-tag write paths
exist and that no read path consumes them yet; how posts' preview blog
routes work (`app/preview/[tenantId]/blog/`) since the public path needs
equivalents.

### Step 2: Decide the architecture

Write up BOTH options with a recommendation:

**Option A — public routes in this repo** (advisor's prior: recommended for
MVP). Sketch to evaluate, not prescribe:
- Route tree: `app/(public)/[[...slug]]/page.tsx` (+ `blog/[slug]`) OR a
  separate `app/sites/[tenant]/...` tree fronted by middleware rewrites.
- Tenant resolution: Next.js middleware/proxy reading `request.headers.host`
  → `Tenant.domain` lookup (with `<slug>.<platform-domain>` subdomain
  fallback) → rewrite to the tenant-scoped tree. Cover: localhost behavior,
  the Vercel preview-URL host, and unknown hosts (404 vs marketing page).
- Render: `status === "PUBLISHED"` gate, `resolvePageWithLayout`, the same
  `PagePreview` component (likely renamed/shared), theme `<link>` reusing
  the theme route (decide: keep it under `/api/preview/theme/...` or move
  to a neutral `/api/theme/...` path — note the URL is embedded in cached
  HTML).
- Caching: this is where the design earns its keep. Evaluate Next 16
  cache semantics for these routes (`"use cache"` / `cacheTag()` /
  `cacheLife` vs `revalidateTag`-style tags) against the existing
  `updateTag` calls in the mutation actions; specify the tag wiring per
  route (page render tagged `page:<path>` + `tenant-theme:<id>` +
  `template:<slug>` for each resolved template — note the resolver must
  *report* which slugs it touched; sketch that return-shape change).
  Cross-check claims against the Next.js 16 docs, not memory.
- Draft-mode interplay: published routes must never leak drafts;
  the preview tree stays as-is.
- Risks: auth gap (admin and public in one deployment — reference the
  "Known but unplanned" index section), per-tenant isolation of cached
  HTML, and the `force-dynamic` admin settings not bleeding into public
  routes.

**Option B — separate renderer deployment** (what the preview comment
implies). Same DB, read-only client, independent scaling/caching, no admin
surface to secure. Costs: second repo/app, shared schema coordination
(Prisma client duplication), cache invalidation across deployments
(`updateTag` doesn't cross apps — would need webhook/revalidate-API calls),
double theme-route implementation.

Decision criteria to apply explicitly: time-to-first-published-site,
cache-invalidation correctness, auth blast radius, operational complexity
at the current team size (solo maintainer).

### Step 3: Write `docs/public-render-design.md`

Sections: **Context** (Step 1 findings, incl. the operator's answer),
**Options** (A/B as above), **Recommendation**, **Build-plan outline** (the
step list a future `improve plan` invocation would turn into an executor
plan: middleware, route tree, render reuse, cache wiring, domain mapping
docs, smoke tests), **Open questions** (root `/` page for a tenant ("home"
path semantics — note `lib/cms/path.ts` reserves `home` implicitly), 404
template, trailing-slash/path normalization, sitemap/robots, the
`/api/preview/theme` URL naming).

**Verify**: doc exists, sections present, each Step-1 claim carries its
command evidence; `git status` shows only the two writable files.

## Test plan

Not applicable (design doc). The build-plan outline must include its own
verification strategy (smoke: publish a page on a tenant with a domain →
fetch by Host header → 200 with content; unpublish → 404).

## Done criteria

- [ ] `docs/public-render-design.md` exists with all five sections
- [ ] The "separate deployment" question is answered and recorded
- [ ] Cache-tag wiring is specified concretely enough to implement (per-route tag list + invalidation source)
- [ ] `git status` shows only the memo + index changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- A public render deployment DOES exist elsewhere — pivot the doc to
  documenting its contract instead of designing a new one; report first.
- You start writing route/middleware code — out of scope; outline only.

## Maintenance notes

- Plan 008's `resolvePageWithLayout` is the intended public entry point;
  the build plan that follows this spike should land after 008.
- The resolver's "which template slugs did this render touch" return-shape
  change (for tag wiring) also benefits the deferred §5 reference-inventory
  feature in `docs/reference/templates-followups.md`.
