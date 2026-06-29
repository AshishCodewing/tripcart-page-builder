# Plan 012: Public render path — build (host-routed published pages)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> This plan is large but the steps are ordered so each is independently
> committable and verifiable; an executor may land it across several PRs.
> Steps 1–4 are read/write-layer prerequisites with no user-visible change;
> Steps 5–9 stand up the public surface; Steps 10–11 reconcile and verify.
>
> **Read first**: `docs/public-render-design.md` (the design this plan
> implements — Option A, recommended) and `plans/009-public-render-spike.md`
> (the spike that produced it).
>
> **Drift check (run first)**:
> `git diff --stat 0647dcc..HEAD -- app lib/cms next.config.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2 (the largest stated-but-undelivered gap — nothing serves published pages)
- **Effort**: L (multi-step: read layer + middleware + route tree + cache wiring)
- **Risk**: HIGH (new public surface; enabling Cache Components changes app-wide rendering semantics; cache-invalidation correctness)
- **Depends on**: plan 009 (design — DONE), plan 008's shipped post-reversion structure (tenant-level chrome in `app/preview/[tenantId]/layout.tsx`)
- **Category**: feature / direction
- **Planned at**: commit `0647dcc`, 2026-06-16

## Why this matters

Pages and posts can be PUBLISHED, but **nothing serves them**. The only
render surface is the draft-mode-gated preview tree
(`app/preview/[tenantId]/...`); the root route is still the scaffold
"Project ready!" placeholder; `Tenant.domain` is collected and stored unique
but consumed nowhere; every `updateTag(...)` call already firing on mutation
invalidates nothing because no read path uses `"use cache"`/`cacheTag`. This
plan closes that gap with Option A from the design: public routes in this
repo, fronted by host→tenant middleware, reusing the preview tree's
renderer/resolver/theme machinery 1:1, with two-level Cache Components tags
so a chrome edit busts one cache entry instead of every page.

## Current state (verified at planning time)

- **No public route, no middleware.** Only non-admin/non-preview `page.tsx`
  is the scaffold (`app/page.tsx`); `next.config.mjs` is empty
  (`const nextConfig = {}`); no `middleware.ts` exists.
- **Cache tags are write-only and not tenant-scoped.**
  `lib/cms/cache-tags.ts`:
  ```ts
  export const cacheTags = {
    page: (path: string) => `page:${path}`,
    post: (slug: string) => `post:${slug}`,
    postIndex: "post-index",
    nav: "nav",
    tenants: "tenants",
    tenantTheme: (tenantId: string) => `tenant-theme:${tenantId}`,
    template: (slug: string) => `template:${slug}`,
  } as const
  ```
  `page`/`post` omit the tenant, so two tenants sharing a path/slug share a
  tag (over-invalidation across tenants). Call sites that must be updated all
  have the tenant id in scope:
  - `page-actions.ts:111-113` (`savePage` — `existing.tenantId`),
    `:133-134` (`deletePage` — selects `tenantId`), `:35` (`createPage` —
    reads `tenantId` from form).
  - `post-actions.ts:76-78` (`savePost` — `existing.tenantId`), `:88-89`
    (`deletePost` — selects `tenantId`).
  - `template-actions.ts` (many `updateTag(cacheTags.template(slug))`) —
    leave global (templates are shared tenant-first/global).
  - `tenant-actions.ts:34/66/73` (`tenants`), `:113-114`
    (`tenantTheme(id)` + `nav`) — add a domain/host-resolution bust on
    create/update (see Step 1).
- **No `"use cache"`/`cacheTag`/`cacheLife`/`revalidateTag` anywhere**, and
  `cacheComponents` is **not** enabled. Confirmed by
  `grep -rn '"use cache"|cacheTag|cacheLife|revalidateTag' app lib`.
- **Render readers don't filter status.** `getPageByPath`
  (`lib/cms/pages.ts:12`) and the post lookup
  (`app/preview/[tenantId]/posts/[slug]/page.tsx:29`) ignore `status` —
  preview relies on the draft gate. Public must add `status = "PUBLISHED"`.
- **Tenant read layer** (`lib/cms/tenants.ts`) has `getTenantBySlug` but
  **no `getTenantByDomain`**.
- **Resolvers return only data, not provenance.** `resolvePageTree` and
  `resolveChromeBySlug` (`lib/cms/templates.ts`) return a
  `ProjectDefinition`; the touched-slug set is tracked internally as
  `ctx.stylesAdded` (`templates.ts:199`, written at `:351`) but not
  returned.
- **Theme route** is `app/api/preview/theme/[tenantId]/[version]/theme.css/
  route.ts` — version-keyed, immutable; the `preview/` segment is a wart for
  public HTML.
- **Preview tree to mirror**: `app/preview/[tenantId]/{layout,page}.tsx`,
  `pages/[...slug]/page.tsx`, `posts/[slug]/page.tsx` + index/authors/
  categories/tags. Chrome via `resolveChromeBySlug(tenantId, "header"|
  "footer")` with `defaultHeader/defaultFooter` fallback
  (`layout.tsx:67-76`); content via `resolvePageTree` + `PagePreview`.
- **Reserved-segment drift**: `lib/cms/path.ts:8`
  `RESERVED_TOP_SEGMENTS = new Set(["blog", "admin", "api", "_next"])` still
  lists `"blog"`, but routes were renamed to `posts/`. An editor can
  currently claim `/posts/...` and collide with the public route.
- **Operator confirmed (009)**: no separate renderer deployment exists —
  build it here.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Generate client | `pnpm prisma generate` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | all pass, incl. new |
| Dev server | `pnpm dev` | serves on :3000 |
| Format | `pnpm format` | exit 0 |
| Host smoke | `curl -sS -H "Host: acme.com" http://localhost:3000/about -o /dev/null -w "%{http_code}\n"` | `200` published / `404` not |

## Scope

**In scope (create unless noted)**:
- `lib/cms/cache-tags.ts` (modify — tenant-scope `page`/`post`, add
  `domain`/`tenant`)
- `lib/cms/page-actions.ts`, `lib/cms/post-actions.ts`,
  `lib/cms/tenant-actions.ts` (modify — update `updateTag` call sites)
- `lib/cms/templates.ts` (modify — return `touchedSlugs` from
  `resolvePageTree` / `resolveChromeBySlug`)
- `lib/cms/pages.ts`, `lib/cms/posts.ts`, `lib/cms/tenants.ts` (modify —
  add published read helpers + `getTenantByDomain`)
- `lib/cms/tenant-routing.ts` (create — `resolveTenantByHost`)
- `middleware.ts` (create)
- `app/sites/[host]/layout.tsx`, `.../page.tsx`,
  `.../pages/[...slug]/page.tsx`, `.../posts/[slug]/page.tsx` (+ post
  index/authors/categories/tags as preview has them) (create)
- `app/api/theme/[tenantId]/[version]/theme.css/route.ts` (create or move)
- `app/page.tsx` (modify — platform root / unknown-host landing)
- `lib/cms/path.ts` (modify — reconcile reserved segments)
- `next.config.mjs` (modify — `cacheComponents: true`)
- `lib/cms/*.test.ts` for new pure helpers
- `.env.example` / env docs (add `PLATFORM_DOMAIN`)
- `plans/README.md` (status row)

**Out of scope (do NOT touch)**:
- The preview tree (`app/preview/...`) — stays draft-gated and unchanged
  except where a shared helper it calls changes signature (Step 2 updates
  its call to `resolvePageTree`/`resolveChromeBySlug` to read `.data`).
- Auth/login — the admin auth gap is referenced but not built here; this
  plan only **host-gates** `/admin` off tenant domains (Step 5).
- The editor / payload production side.
- The React renderer internals (`lib/plugins/react-renderer/...`).
- Sitemap/robots, custom per-tenant 404 design — deferred (Open Questions).

## Git workflow

- Branch: `advisor/012-public-render-build`
- Commit per step; conventional style (e.g.
  `feat: tenant-scope page/post cache tags`,
  `feat: host-routed public render tree`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Tenant-scope cache tags + add a host-resolution tag

In `lib/cms/cache-tags.ts`:
- Change `page` and `post` to take `tenantId`:
  `page: (tenantId: string, path: string) => `page:${tenantId}:${path}``;
  `post: (tenantId: string, slug: string) => `post:${tenantId}:${slug}``.
- Tenant-scope `postIndex` too:
  `postIndex: (tenantId: string) => `post-index:${tenantId}``.
- Add `domain: (host: string) => `domain:${host}`` (busts host→tenant
  resolution when a tenant's domain changes).
- Keep `template`, `nav`, `tenants`, `tenantTheme` as-is.
  `template:<slug>` **stays global** — templates resolve tenant-first /
  global-fallback and are genuinely shared.

Update every call site (all have the tenant id in scope — see Current
state): `page-actions.ts:35/111-113/133-134`,
`post-actions.ts:76-78/88-89`. In `tenant-actions.ts`, on create/update
when `domain` changes, add `updateTag(cacheTags.domain(domain))` (and the
old domain if it changed).

**Verify**: `pnpm typecheck` → exit 0; `grep -rn "cacheTags.page\|cacheTags.post" lib`
shows every call passing a tenant id.

### Step 2: Surface resolver provenance (`touchedSlugs`)

In `lib/cms/templates.ts`, change `resolvePageTree` and
`resolveChromeBySlug` to return `{ data, touchedSlugs }` where
`touchedSlugs` is `[...ctx.stylesAdded]` (the set already maintained at
`:351`; rename it conceptually to "slugs this render resolved" — it already
captures every `template-ref` slug expanded). `resolveChromeBySlug`'s
internal `resolvePageTree` call must thread the inner `touchedSlugs` out.

Update all existing callers to read `.data`:
- `app/preview/[tenantId]/layout.tsx` (header/footer),
- `app/preview/[tenantId]/page.tsx`,
- `app/preview/[tenantId]/pages/[...slug]/page.tsx`,
- `app/preview/[tenantId]/posts/[slug]/page.tsx`.

Add unit tests in `lib/cms/templates.test.ts`: a page with two distinct
refs reports both slugs; a ref used twice reports it once; a page with no
refs reports `[]`.

**Verify**: `pnpm test` (existing `templates.test.ts` still green + new
cases); `pnpm typecheck`. Preview still renders (manual or existing tests).

> Note: this return-shape change also unblocks the deferred §5
> reference-inventory feature in `docs/reference/templates-followups.md`.

### Step 3: Published read helpers (status-filtered)

Add, without altering the existing preview readers:
- `lib/cms/pages.ts`: `getPublishedPageByPath(tenantId, path)` —
  `findFirst({ where: { tenantId, path, status: "PUBLISHED" } })`, wrapped
  in React `cache` like `getPageByPath`.
- `lib/cms/posts.ts`: `getPublishedPostBySlug(tenantId, slug)` and a
  published post-index list (`status: "PUBLISHED"`, ordered by
  `publishedAt desc`).
- All read `data` (never `draftData`).

Add a published page-list helper if the home/index routes need it.

**Verify**: `pnpm typecheck`; a quick unit/integration test if a DB test
harness is available, else defer to Step 11 smoke.

### Step 4: Host → tenant resolution

- `lib/cms/tenants.ts`: add `getTenantByDomain(domain)` —
  `findUnique({ where: { domain } })`.
- `lib/cms/tenant-routing.ts` (create): `resolveTenantByHost(host)` —
  1. exact `getTenantByDomain(host.toLowerCase())`;
  2. else if `host` ends with `.${PLATFORM_DOMAIN}`, take the left-most
     label as a slug → `getTenantBySlug`;
  3. else `null`.
  Read `PLATFORM_DOMAIN` from `process.env`. Keep this function pure of
  `headers()`/`cookies()` — it takes `host` as a plain argument so it can be
  cached later (Step 7).

Add `PLATFORM_DOMAIN` to `.env.example` and the env docs (e.g.
`localhost:3000` for dev so `acme.localhost:3000` maps to slug `acme`).

**Verify**: `pnpm typecheck`; unit test the host-parsing branches with a
fixed `PLATFORM_DOMAIN` (exact-domain, subdomain, unknown).

### Step 5: Middleware — host rewrite + admin host-gate

Create `middleware.ts` (root). It does a **pure string rewrite — no DB**:
- Skip `_next`, `api`, static assets (matcher config).
- If the request host is the platform domain or localhost-root → pass
  through (serves `app/page.tsx`, `/admin`, `/api`, `/preview` as today).
- **Block `/admin` (and admin-only API) when the host is a tenant host**
  (not the platform domain) → `notFound()`/404. Admin stays reachable only
  on the platform domain. (This is the cheap mitigation for the
  admin/public co-tenancy auth risk noted in the design.)
- Otherwise rewrite `https://<host>/<path>` →
  `/sites/<host>/<path>` so the `[host]` segment carries the raw host.

Decide and document localhost dev convention (subdomain
`acme.localhost:3000`, or a `?tenant=` escape hatch). Note the Vercel
preview-URL host falls under "platform domain" handling.

**Verify**: `pnpm dev`; `curl -H "Host: <platform>" localhost:3000/admin`
→ reachable; `curl -H "Host: acme.com" localhost:3000/admin` → 404;
`curl -H "Host: acme.com" localhost:3000/about` rewrites (next step makes it
render).

### Step 6: Public route tree under `app/sites/[host]/`

Mirror the preview tree, with three differences: tenant comes from the
`[host]` param (resolved via `resolveTenantByHost`), **no draft-mode gate**,
and reads are **status-filtered** (Step 3).

- `layout.tsx`: resolve tenant from `host`; if null → `notFound()`. Emit the
  theme `<link>` (Step 8 URL) and render chrome via `resolveChromeBySlug`
  (reading `.data` per Step 2) with `defaultHeader/defaultFooter` fallback —
  same as `app/preview/[tenantId]/layout.tsx:67-108` minus the
  `draftMode()` gate.
- `page.tsx`: home = `getPublishedPageByPath(tenantId, "home")` →
  `resolvePageTree(...).data` → `PagePreview rootTag="main"`. `notFound()`
  if absent.
- `pages/[...slug]/page.tsx`: `getPublishedPageByPath(tenantId,
  slug.join("/"))`.
- `posts/[slug]/page.tsx` (+ index/authors/categories/tags as preview has):
  `getPublishedPostBySlug`. Never read `draftData`; never call
  `draftMode()`.

**Verify**: publish a page on a tenant with a domain, `pnpm dev`,
`curl -H "Host: <domain>" localhost:3000/<path>` → 200 with content;
unpublish → 404; confirm header/footer render once and persist across
navigation.

### Step 7: Enable Cache Components + wire `"use cache"` / `cacheTag` / `cacheLife`

> **Highest-risk step.** Enabling `cacheComponents: true` turns on Partial
> Prerendering app-wide: any route reading runtime data
> (`cookies`/`headers`/`searchParams`/uncached DB) outside `Suspense` or
> `"use cache"` becomes a build error. The preview tree uses `draftMode()`
> (dynamic) and admin may read cookies — **expect to wrap or annotate
> those**. Land this only after Steps 1–6 are green, and be ready to
> revert this single commit if the regression sweep fails.

- `next.config.mjs`: `const nextConfig = { cacheComponents: true }`.
- Wrap the two public reads as cached functions (host arrives as a route
  param, so it's a serializable arg — never read `headers()` inside
  `"use cache"`):
  - **Chrome**: a cached function returning resolved header/footer; inside,
    `"use cache"` + `cacheLife("days")` + `cacheTag(cacheTags.tenantTheme(id))`
    + `cacheTag(cacheTags.template(slug))` for **each** slug in the chrome's
    `touchedSlugs` (header, footer, nested parts).
  - **Page/post content**: `"use cache"` + `cacheLife("days")` +
    `cacheTag(cacheTags.page(tenantId, path))` (or `post(...)`) +
    `cacheTag(cacheTags.template(slug))` per `touchedSlugs`. Also tag
    `cacheTags.tenantTheme(id)` so a theme bump (which rotates the embedded
    theme `<link>` URL) refreshes the cached HTML.
  - **Host resolution** (`resolveTenantByHost`): `"use cache"` +
    `cacheTag(cacheTags.domain(host))` + `cacheTags.tenants`.
- Because chrome and content are separately cached, `updateTag(template(
  "header"))` busts only the chrome entry; page-content entries survive —
  the instant-publish property. Cross-check the directive/`cacheLife`/
  `cacheTag` API against the Next.js 16 Cache Components docs (do not rely
  on memory): runtime APIs are forbidden inside `"use cache"`; `updateTag`
  (already used by the actions) is immediate same-request invalidation,
  which is what publish wants.

**Verify**: `pnpm build` succeeds (no PPR build errors from preview/admin —
if there are, wrap the offending dynamic reads in `Suspense` or mark the
route, and record what you changed). Then: edit a header template → page
content still served from cache (unchanged HTML) while the header updates;
two tenants sharing `/about` → publishing on one does not bust the other
(tenant-scoped tags from Step 1).

### Step 8: Neutralize the theme route URL

The theme URL is embedded in cached public HTML, so `preview/` in the path
is wrong for public. Create
`app/api/theme/[tenantId]/[version]/theme.css/route.ts` with the same
handler body as the preview route. Point the **public** layout at
`/api/theme/...`. Keep the existing `/api/preview/theme/...` route for the
preview layout (or re-export the shared handler from one module to avoid
duplication — preferred).

**Verify**: `curl -I "http://localhost:3000/api/theme/<tenantId>/<v>/theme.css"`
→ 200, `cache-control: public, max-age=31536000, immutable`; public page
HTML references `/api/theme/...`.

### Step 9: Replace the scaffold root page

`app/page.tsx` currently renders "Project ready!". Replace with the platform
root for the platform-domain host (a minimal marketing/landing or a redirect
to `/admin`), which is also where unknown tenant hosts land if you chose
"marketing page" over 404 in Step 5.

**Verify**: `curl -H "Host: <platform>" localhost:3000/` → the new root, not
the scaffold.

### Step 10: Reconcile reserved top-level segments

`lib/cms/path.ts:8` reserves `"blog"` but the route segment is now
`posts/`. Add `"posts"` (and `"sites"`, the new public segment root) to
`RESERVED_TOP_SEGMENTS`; decide whether to keep `"blog"` (only if a
`/blog` route still exists — it does not, so drop it unless you want a
reserved redirect). Update `path.test.ts` accordingly.

**Verify**: `pnpm test` (path tests); attempting to create a top-level page
with slug `posts` throws.

### Step 11: Smoke tests + docs

- Update `docs/handbook/preview.md` — the "separate deployment" claim is now
  false; replace with "public rendering is served by `app/sites/[host]/`,
  host-routed via `middleware.ts`."
- Add a short domain-mapping runbook (how `Tenant.domain` /
  `<slug>.<PLATFORM_DOMAIN>` map to routes; dev convention).
- End-to-end smoke (record results in your report):
  1. Tenant with `domain=acme.com`, a PUBLISHED `home` + `/about` →
     `curl -H "Host: acme.com" /` and `/about` → 200 with content.
  2. Unpublish `/about` → 404.
  3. Draft-only page → 404 on public; still 200 in preview (draft mode).
  4. Edit header template → `/about` HTML unchanged-from-cache except header.
  5. Second tenant sharing `/about` → publishing on tenant A leaves tenant
     B's cached `/about` intact.
  6. `/admin` on a tenant host → 404; on platform host → reachable.

## Test plan

- New pure-function unit tests: `tenant-routing` host parsing (Step 4),
  `templates` `touchedSlugs` (Step 2), `path` reserved segments (Step 10).
- Cache behavior and status gating are integration-level — covered by the
  Step 11 smoke checklist (no DB-backed test harness exists yet; if plan
  001's harness gains DB fixtures later, lift checks 1–3 into it).

## Done criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all exit 0
- [ ] Publishing a page on a tenant with a domain serves it by Host header
      (200); unpublishing returns 404; drafts never appear on public routes
- [ ] `grep -rn "cacheTags.page\|cacheTags.post" lib` — every call is
      tenant-scoped
- [ ] `resolvePageTree`/`resolveChromeBySlug` return `touchedSlugs`; the
      public reads tag `page`/`post` + `template(slug)` per touched slug +
      `tenantTheme`
- [ ] Editing chrome busts only the chrome cache entry (smoke check 4)
- [ ] `/admin` is unreachable on tenant hosts (smoke check 6)
- [ ] Public HTML references `/api/theme/...`, not `/api/preview/theme/...`
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Enabling `cacheComponents: true` (Step 7) causes build errors in the
  preview or admin trees that you cannot resolve by wrapping the dynamic
  read in `Suspense` or `"use cache"` without changing those routes'
  behavior — report the failing route and the dynamic API it uses. (Cache
  wiring may need to be split into its own follow-up plan.)
- Next.js 16 Cache Components semantics diverge from the design's
  assumptions (e.g. `cacheTag` can't be called the way Step 7 expects) —
  report the divergence before improvising a different caching approach.
- The chrome/content tags can't be made to invalidate independently (smoke
  check 4 fails) — the two-level caching is the core value; report rather
  than collapse to a single merged cache.
- Any in-scope action file's `updateTag` call sites no longer match the
  excerpts (drift).
- You find a real need for auth/login to ship this safely beyond the
  host-gate — out of scope; report so it can be sequenced first.

## Maintenance notes

- The host-gate on `/admin` (Step 5) is a stopgap, not auth. The standing
  admin-auth gap (see `plans/README.md` "Known but unplanned") should still
  be planned independently; this plan only narrows the blast radius.
- `PLATFORM_DOMAIN` is environment-specific — document per-env values
  (local, preview, prod) alongside `DATABASE_URL`.
- The neutral `/api/theme` route and the preview route should share one
  handler module (Step 8) so the theme-compile contract has a single source.
- Open questions deferred from the design (resolve as follow-ups): per-tenant
  custom 404 template, trailing-slash normalization, per-tenant
  sitemap/robots driven by PUBLISHED content.
- If the public surface later needs a hard security boundary or independent
  scaling, revisit Option B (separate renderer) from
  `docs/public-render-design.md` §2.
