# Public render path — design (how published pages actually get served)

> **⚠️ BUILD DEFERRED (2026-06-16).** Project scope is the page **builder**,
> not serving the live public site to visitors. This design (and its executor
> plan `plans/012-public-render-build.md`) is complete and ready to build
> *if/when greenlit*. Until then, `Tenant.domain`, the `PUBLISHED` status, and
> the `updateTag` cache-tag calls intentionally feed nothing on the read side
> — that's expected, not a bug. Revisit when serving published sites becomes a
> priority.

> Design spike output for `plans/009-public-render-spike.md`. **No source
> code was changed by this spike** — this is a design document plus a
> build-plan outline for a future executor. Investigated read-only at
> commit `0647dcc`.

## 1. Context (current state, with evidence)

The publish lifecycle exists end-to-end on the **write** side and serves
**nothing** on the read side. Verified claims:

- **No public route exists.** The only non-admin / non-preview `page.tsx`
  is the scaffold:
  `find app -name "page.tsx" | grep -v admin | grep -v preview` →
  `app/page.tsx`, which still renders the "Project ready!" placeholder
  (`app/page.tsx:1-20`). There is **no middleware** (`find . -maxdepth 2
  -name "middleware.*"` → none) and `next.config.mjs` is empty (`const
  nextConfig = {}`), so no rewrites/redirects are in play.

- **`Tenant.domain` is collected but never consumed for routing.**
  `grep -rn "domain" app lib` shows it only in the admin form/list
  (`app/admin/(shell)/tenants/page.tsx`, `.../[id]/page.tsx`) and the
  write/uniqueness path (`lib/cms/tenant-actions.ts:16-63`). The read layer
  has `getTenantBySlug` (`lib/cms/tenants.ts:23`) but **no
  `getTenantByDomain`** and nothing maps a request host → tenant.

- **Cache invalidation is wired one-directionally — writes tag, nothing
  reads.** `grep -rn 'cacheTags|updateTag|cacheTag|cacheLife|"use cache"|
  revalidateTag'` finds **only** `updateTag(...)` calls in the four
  `*-actions.ts` files (`page-actions`, `post-actions`, `template-actions`,
  `tenant-actions`) plus the `cacheTags` factory (`lib/cms/cache-tags.ts`).
  There is **no `"use cache"`, no `cacheTag()`, no `cacheLife`, no
  `revalidateTag`** anywhere, and `next.config.mjs` does **not** set
  `cacheComponents: true`. So every `updateTag` call today invalidates
  nothing — the tags are a contract waiting for a read side. (Confirmed
  against the comment in `cache-tags.ts:8-12`: resolver caching "isn't
  wired yet".)

- **Status gating exists on the model but the read helpers don't apply
  it.** `grep -rn "PUBLISHED"` shows `ContentStatus` is read in admin
  tables and in the publish/unpublish actions, but the render-side readers
  `getPageByPath` (`lib/cms/pages.ts:12`) and the post lookup
  (`app/preview/[tenantId]/posts/[slug]/page.tsx:29`) **do not filter on
  status** — preview relies entirely on the draft-mode gate instead. A
  public path must add an explicit `status = "PUBLISHED"` filter.

- **The preview tree is the structural template to mirror.** Shipped
  (post-008-reversion) shape:
  - `app/preview/[tenantId]/layout.tsx` — the **single draft-mode gate**
    (`draftMode()` → `notFound()` if off, `:46-47`), emits the tenant theme
    `<link>` (`:80-86`), and renders site chrome (header/footer) once via
    `resolveChromeBySlug(tenantId, "header"|"footer")` with code-default
    fallback (`:67-76`). Chrome persists across navigation because it lives
    in this layout segment.
  - `app/preview/[tenantId]/page.tsx` — tenant home: the Page at reserved
    path `"home"` (`:20`).
  - `app/preview/[tenantId]/pages/[...slug]/page.tsx` — content page by
    hierarchical `path` via `(tenantId, path)` compound key.
  - `app/preview/[tenantId]/posts/[slug]/page.tsx` + index/authors/
    categories/tags routes.
  - All content pages render content-only through `resolvePageTree` +
    `PagePreview` (`components/page-builder/page-preview.tsx`). Chrome and
    page are resolved **separately** — this is exactly the independent-
    chrome property the cache design exploits below.

- **Theme is served version-keyed + immutable** at
  `app/api/preview/theme/[tenantId]/[version]/theme.css/route.ts`. The
  `[version]` segment is a cache-buster (always serves *current* theme);
  `updateTenantTheme` bumps `Tenant.themeVersion` so the embedded URL
  rotates on edit. The route name contains `preview/` — a wart if reused
  verbatim in cached public HTML (see Open Questions).

- **Publish-time CSS artifacts (Option B future-proofing) shipped** — see
  `docs/plans/023-css-artifact-pipeline.md`. Every `data` write bakes a
  per-entity, unresolved CSS artifact onto the row (`Page/Post/Template.css`,
  `Tenant.themeCss`), served immutable at
  `app/api/css/[kind]/[id]/[hash]/styles.css`. Option A serving (inline
  hoisted `<style>` from render-time stringification) is unchanged; the
  artifacts exist so a future read-only renderer can link stylesheets
  without importing the compiler.

- **Resolvers return only rendered data, not provenance.**
  `resolvePageTree` and `resolveChromeBySlug` (`lib/cms/templates.ts`)
  return a `ProjectDefinition`; the set of template slugs each render
  touched is tracked internally (`ctx.stylesAdded`, `:199`/`:351`) but not
  surfaced. Tag wiring needs that set exposed (see Build plan step 2).

- **Vercel linkage.** `.vercel/project.json` →
  `tripcart-page-builder` (one project). No second linked app.

### Operator question (required by the plan) — answered

> *Does a separate public-renderer deployment already exist outside this
> repo?*

**No — it is aspirational.** Confirmed with the maintainer (2026-06-16).
The repo docs assert one — `docs/handbook/preview.md:7-10` ("Public
rendering … happens in a **separate deployment** that consumes the same
database") and the (now-deleted) preview-route comment — but no such code,
repo, or second `.vercel` link exists, and the only linked Vercel project
is this one. The STOP condition ("a deployment DOES exist → document its
contract") therefore does **not** apply; this spike designs the path from
scratch.

## 2. Options

### Option A — public routes in this repo (recommended)

Add a public route tree alongside the existing preview tree, fronted by
middleware that maps the request host to a tenant.

**Route tree.** Mirror the preview tree under a host-scoped segment so the
two stay structurally identical and the renderer/resolver/theme code is
reused 1:1:

```
app/sites/[host]/layout.tsx              ← chrome + theme link, NO draft gate
app/sites/[host]/page.tsx                ← home (Page at path "home")
app/sites/[host]/pages/[...slug]/page.tsx
app/sites/[host]/posts/[slug]/page.tsx   (+ index/authors/categories/tags)
```

Middleware rewrites `https://acme.com/about` →
`/sites/acme.com/pages/about` (a **pure string rewrite — no DB call in
middleware**). The `[host]` segment then resolves host → tenant inside an
RSC, where it can be cached. This is the key constraint from Next 16 Cache
Components: `cookies()/headers()` **cannot** be read inside `"use cache"`,
so the host must arrive as a serializable route param, not a runtime header
read. (Verified against the Cache Components guide.)

**Tenant resolution** (`resolveTenantByHost(host)`, cached):
1. exact `Tenant.domain` match (new `getTenantByDomain` read);
2. fallback `<slug>.<PLATFORM_DOMAIN>` → `getTenantBySlug`;
3. localhost / Vercel preview-URL host → resolve via `PLATFORM_DOMAIN`
   subdomain convention or a `?tenant=` dev escape hatch;
4. unknown host → `notFound()` (or a platform marketing page).

**Render.** The public `layout.tsx` resolves chrome via the existing
`resolveChromeBySlug` and emits the theme `<link>`, but **omits the
draft-mode gate** (public never enables draft mode → drafts can't leak).
The page renders content-only via `resolvePageTree` + the shared renderer
(`PagePreview`, likely renamed to something host-neutral — out of scope,
noted). Reads filter `status = "PUBLISHED"` and use `data` (never
`draftData`).

**Caching (Next 16 Cache Components — the payoff).** Enable
`cacheComponents: true`, then wrap the two resolvers as separately-cached
functions:
- **Chrome** read: `"use cache"` + `cacheTag(tenantTheme(id))` +
  `cacheTag(template(slug))` for *each* PART it touched (header, footer, and
  any nested part). `cacheLife('days')`.
- **Page content** read: `"use cache"` + `cacheTag(page(tenantId, path))` +
  `cacheTag(template(slug))` for each ref it resolved. `cacheLife('days')`.

Because chrome resolves independently of page content, editing the site
header runs `updateTag(template("header"))` and busts **only the chrome
cache entry** — every page's content stays served from cache. That is the
instant-publish win the architecture buys (vs. a single merged tree where
every page's baked copy would need refreshing). The existing `updateTag`
calls already fire on the right mutations — they just need a read side to
act on. `updateTag` (immediate, same-request fresh) is the correct choice
the actions already make; `revalidateTag` would be background SWR.

**Risks (Option A):**
- **Auth blast radius.** Admin (`app/admin`, currently unauthenticated —
  see the "Known but unplanned" auth gap) lives in the same deployment as
  public traffic. Mitigation is cheap and concrete: the same middleware
  that rewrites tenant hosts should **block `/admin` on tenant hostnames**,
  leaving admin reachable only on the platform domain. Admin auth remains a
  must-do regardless.
- **Cache tags are not tenant-scoped.** `cacheTags.page(path)` →
  `page:${path}` and `cacheTags.post(slug)` → `post:${slug}` omit the
  tenant. Two tenants sharing `/about` share one tag, so tenant A's publish
  needlessly busts tenant B's cache entry (over-invalidation; the cache
  *key* is still correctly per-tenant via the `tenantId` arg, so it's wasted
  work, not a stale-content leak). **Fix before launch:** tenant-scope the
  page/post tags (`page:<tenantId>:<path>`). The `template:<slug>` tag
  should stay global — global templates are genuinely shared across
  tenants.
- **`force-dynamic` bleed.** Public routes must stay cacheable; confirm no
  shared layout forces dynamic. Separate route segments don't inherit
  admin's settings, so this is a check, not a blocker.

### Option B — separate renderer deployment

A second app (same Postgres, read-only Prisma client) serves published
pages; this repo keeps only editor + preview + admin. This is what the docs
originally implied.

- **Pros:** clean auth boundary (no admin in the public app), independent
  scaling, no `force-dynamic` bleed risk.
- **Cons:** second repo/app to operate; Prisma client + schema
  duplication to keep in lockstep; **cross-deployment cache invalidation**
  — `updateTag` does not cross apps, so every publish/template/theme
  mutation in this repo would need to call a revalidate webhook/API on the
  renderer (the hardest correctness surface, built from scratch); a second
  theme-route implementation.

## 3. Recommendation — Option A for MVP

Decision against the plan's four criteria:

| Criterion | Winner | Why |
|---|---|---|
| Time-to-first-published-site | **A** | Reuses layout, renderer, resolver, theme route, and `cacheTags` 1:1. B needs a second repo + schema coordination first. |
| Cache-invalidation correctness | **A** | `updateTag` already fires in-process on the right mutations; A just adds the read side. B must build cross-app invalidation — the easiest thing to get wrong. |
| Auth blast radius | B (but mitigable in A) | A's admin/public co-tenancy is closed by host-gating `/admin` in middleware; admin auth is required either way. |
| Operational complexity (solo maintainer) | **A** | One deploy, one Prisma client, one CI, one theme route. |

Three of four favor A; the one that favors B is mitigable and independent.
**Build Option A.** Revisit B only when the public surface needs a hard
security boundary or independent scaling.

## 4. Build-plan outline (for a future `improve plan` → executor)

Ordered; early steps are prerequisite correctness fixes that also benefit
preview.

1. **Tenant-scope cache tags.** Change `cacheTags.page`/`cacheTags.post` to
   take `tenantId` (`page:<tenantId>:<path>`). Add `cacheTags.tenant(id)`
   and/or `cacheTags.domain(host)` for the host-resolution cache. Update the
   `updateTag` call sites in `page-actions.ts` / `post-actions.ts` and add
   one in `tenant-actions.ts` create/update (domain change must bust host
   resolution). `template:<slug>` stays global. *Verify:* tags emitted on
   publish include the tenant id.
2. **Resolver provenance.** Change `resolvePageTree` and
   `resolveChromeBySlug` to return `{ data, touchedSlugs }` (expose the
   `ctx.stylesAdded` set already maintained at `templates.ts:199/351`).
   Update preview callers (no behavior change). This also unblocks the
   deferred §5 reference-inventory feature in
   `docs/reference/templates-followups.md`.
3. **Published read helpers.** `getPublishedPageByPath(tenantId, path)`,
   `getPublishedPostBySlug(tenantId, slug)`, and published index lists —
   each adding `status: "PUBLISHED"` and reading `data` (not `draftData`).
   Leave preview's unfiltered readers untouched.
4. **Host → tenant resolution.** Add `getTenantByDomain`; write
   `resolveTenantByHost(host)` (exact-domain → slug-subdomain fallback),
   wrapped in `"use cache"` + `cacheTag(domain/tenant)` + `cacheLife`.
5. **Middleware.** Pure string rewrite `host` + path →
   `/sites/<host>/...`; localhost / preview-URL handled via `PLATFORM_DOMAIN`
   env; unknown host → 404 / marketing. **Host-gate `/admin`** off tenant
   hostnames. No DB in middleware.
6. **Public route tree** under `app/sites/[host]/` mirroring preview:
   `layout.tsx` (chrome via `resolveChromeBySlug`, theme `<link>`, **no**
   draft gate, `"use cache"` + tags from step 2's `touchedSlugs`),
   `page.tsx` (home), `pages/[...slug]/page.tsx`, `posts/[slug]/page.tsx`
   + indexes — all status-filtered via step 3.
7. **Enable Cache Components.** `cacheComponents: true` in `next.config.mjs`
   (required before any `"use cache"` works). Apply `"use cache"` +
   `cacheTag()` + `cacheLife('days')` to the chrome and content reads using
   the `touchedSlugs` lists.
8. **Theme route naming.** Move/alias `/api/preview/theme/...` →
   `/api/theme/...` (neutral) since the URL is embedded in cached public
   HTML; keep preview pointing at the same handler. The chrome/page cache
   entries must also tag `tenantTheme(id)` so the embedded `<link href>`
   refreshes on a theme bump.
9. **Replace the scaffold `app/page.tsx`** with the platform root (marketing
   / unknown-host landing).
10. **Docs + smoke tests** (below); add a domain-mapping runbook.

**Verification strategy (for the executor):**
- Publish a page on a tenant with a domain → `curl -H "Host: acme.com"` →
  `200` with content; unpublish → `404`.
- Edit the header template → assert page content still served from cache
  (unchanged) while header updates (chrome tag busted, content tags not).
- Two tenants sharing path `/about` → publishing on A does not bust B's
  cache entry (confirms tenant-scoped tags).
- Confirm a public route never enables draft mode and never reads
  `draftData`.

## 5. Open questions

- **Home path semantics.** Public `/` → the Page at reserved path `"home"`
  (`lib/cms/path.ts:6-8` reserves it implicitly via the unique `path`
  constraint). Confirm the home Page must be PUBLISHED for `/` to 200, and
  decide the empty-tenant `/` behavior.
- **404 template.** Per-tenant custom 404 (a reserved slug PART/LAYOUT) or
  a generic platform 404?
- **Reserved-segment drift.** `path.ts` `RESERVED_TOP_SEGMENTS` still lists
  `"blog"`, but the routes were renamed to `posts/` (008 reversion). The
  public route tree uses `posts/…`, so `"posts"` must be reserved and
  `"blog"` is likely stale. Reconcile before public launch (an editor could
  currently claim `/posts/...` and collide with the route).
- **Trailing slash / path normalization.** Decide canonical form and
  redirect the other (affects cache keys and SEO).
- **Sitemap / robots.** Per-tenant `sitemap.xml` / `robots.txt` driven by
  PUBLISHED content — out of MVP scope but should be acknowledged.
- **Theme URL naming.** Final neutral path for the theme route (step 8) and
  whether to keep a `preview/` alias for the editor.
