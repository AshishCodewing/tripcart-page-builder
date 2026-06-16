# Layout render fork — Phase 0 spike memo (Approach A)

> **⚠️ ABANDONED / REVERTED (2026-06-15). Historical record only.** The entire
> Approach-A chrome model this memo designed — per-page `Page.layoutSlug`
> zones, the region-routing `proxy.ts`, `[zone]` route layouts, the
> `content-slot` component, `resolveLayoutChrome` — was built, verified, and
> then **fully reverted**. We replaced it with a much simpler model:
> **site chrome is two tenant-assigned templates** (`Tenant.headerTemplateId`
> / `footerTemplateId`, FK → `Template`) rendered once in
> `app/preview/[tenantId]/layout.tsx` via `resolveTemplateChrome`, with the
> preview routes following next-wp structure (`pages/[...slug]`,
> `posts/[slug]`, …). No zones, no proxy, no per-page layout assignment, no
> content slot. Migration `20260615082506_replace_page_zone_with_tenant_chrome`
> dropped `layoutSlug` and added the tenant settings. The probe findings below
> (A2 can't persist; a rewrite can) remain technically valid but no longer
> drive any shipped code.

Decision memo for `plans/008-layout-content-slot.md` Phase 0. Resolves the two
mechanics Phase 2 (the render restructure) is gated on:

1. **A2 vs A1** — how the LAYOUT frame is mounted in the route tree.
2. **The slot-boundary representation** — how page content lands in the
   LAYOUT's `content-slot` at render.

Context: `docs/reference/templates-followups.md` §14 (Approach A design),
`docs/reference/header-footer-architecture-options.md` (why A / the zones
model / the persistence asymmetry), `docs/reference/wp-template-hierarchy.md`.

**Environment checked:** Next.js **16.2.9**, stock config (no PPR, no
`cacheComponents`, no `force-dynamic`). Preview routes are **draft-mode
dynamic** (`draftMode()` + `notFound()` when off) — navigation between preview
pages is App-Router soft client navigation.

---

## Status update (2026-06-15): A1 shipped (not deferred)

The original recommendation was "ship A2 now, defer A1." That flipped once two
follow-up probes (below) showed A1's rewrite approach is both cheap and
correct. **We built A1 directly:** a `proxy.ts` rewrites the clean URL
`/preview/<t>/<path>` → `/preview/<t>/<zone>/<path>`, and the zone layout lives
at the `[zone]` segment (above `[...slug]`), so chrome persists across
same-zone navigation while the public URL stays clean. The intermediate A2
layout (`[...slug]/layout.tsx`) was replaced. See "Implementation" at the
bottom. The reasoning below is preserved as the decision record.

## TL;DR (the decisions — as built)

- **A1 region routing, shipped.** `proxy.ts` (Node runtime — `proxy.ts` always
  is in Next 16) looks up `Page.layoutSlug` and rewrites to a zoned route;
  `app/preview/[tenantId]/[zone]/{layout,[...slug]/page}.tsx` puts the chrome
  layout *above* the page segment. Clean URLs + per-zone chrome + cross-nav
  persistence within a zone; crossing zones swaps the frame.
- **A2 was the fallback** (dynamic `[...slug]/layout.tsx`, no persistence) —
  correct but the layout sits *at* the changing segment so it can't persist.
  Built first, then superseded by A1 once the probes cleared it.
- **The slot is the existing `content-slot` node + the renderer's
  `config.slotContent`** (built in the prep refactor). **No
  `content-slot-boundary` type, and no `resolveNode` slot branch.** Resolver
  work is just the thin `resolveLayoutChrome` composer.

---

## 1. A2 vs A1 — how layout persistence actually works in the App Router

The product doc's headline A benefit is *"menus/drawers stay open while the
visitor moves between pages."* Whether A2 delivers that turns on one App
Router rule:

> A layout is preserved (not re-rendered, client state intact) across a
> navigation **only when it sits at a route level _above_ the segment whose
> value changes.** A layout *at* the changing segment re-renders, because its
> own params changed.

Map that to our routes. Pages are a catch-all `[...slug]`, and the zone is a
**DB field** (`Page.layoutSlug`), not part of the URL. So:

### A2 — dynamic layout at the changing segment

```
app/preview/[tenantId]/[...slug]/
├── layout.tsx   ← reads (tenantId, path) → page.layoutSlug → chrome
└── page.tsx     ← page content fragment
```

Navigating `/about → /pricing` changes the `[...slug]` value. The layout
`[...slug]/layout.tsx` lives **at** that segment, so its `params.slug`
changes and **it re-renders** (re-resolves chrome) on every navigation. Any
client state inside the chrome (an open drawer) is torn down and rebuilt.

- ✅ **Correct render** — chrome + page content compose correctly.
- ✅ **Instant publish** — chrome resolves from `layoutSlug` independently of
  the page, so a header edit invalidates one cache entry, not every page.
- ✅ **Smallest change** — reuses everything already built.
- ❌ **No cross-navigation state persistence** — the headline A benefit is
  NOT delivered. The re-render is a (small) perf cost too, mitigated by
  caching `resolveLayoutChrome` on `(tenantId, zoneSlug, version)`.

### A1 — zone layout above the changing segment ("region routing")

To preserve the frame, the zone layout must sit *above* `[...slug]`:

```
app/preview/[tenantId]/(zone)/
├── layout.tsx          ← resolves chrome for THIS zone; stable across
│                          same-zone page navigations (its params don't
│                          include the page slug)
└── [...slug]/page.tsx  ← only this re-renders on navigation
```

Now `/about → /pricing` within the same zone changes only `[...slug]/page.tsx`;
the zone `layout.tsx` is shared and **preserved** — client islands in the
chrome keep their state. This is the "region navigation" model the WP
ecosystem is moving toward (header-footer doc, "WordPress precedent").

The catch: route groups `(zone)` don't appear in the URL and **can't be
selected from a DB field at request time**. A1 therefore needs a **rewrite
layer** (Vercel Routing Middleware / `proxy`) that looks up the page's zone
and rewrites `/about` → an internal `…/(standard)/about` (or a real path
segment like `…/standard/about`). That's the real A1 cost: a request-time
zone lookup + rewrite, plus one layout file per zone.

Two further conditions for A1 to actually keep a drawer open — both must hold,
neither is automatic:
1. The interactive element is a **Client Component island** inside the chrome
   (our chrome renders from GrapesJS JSON as server components today; an
   interactive cart drawer is a separate piece of work).
2. The navigation is a **soft** client navigation (it is, under draft mode /
   the App Router Link).

### Recommendation: A2 now, A1 when persistence is demanded

A2 is the correct MVP: it ships the inversion (route owns chrome, page owns
content), the instant-publish property, and reuses the prep-refactor
primitives — at the cost of the one benefit (persistent interactive chrome)
that we have **no interactive chrome element to use yet**. A1 is a clean
layering-on later (same `resolveLayoutChrome`, different mount point + a
rewrite), exactly the asymmetry the header-footer doc describes: *A's
properties can be added incrementally; we take the correct-render slice first.*

### Confirm before committing (15-minute probe)

The reasoning above is from the App Router model, not this repo's runtime —
**verify it empirically before building Phase 2**, since a wrong assumption
flips the whole fork:

1. Add a throwaway `app/preview/[tenantId]/[...slug]/layout.tsx` rendering a
   tiny Client Component with `useState` (a counter + button) around
   `{children}`.
2. With draft mode on, open `/about`, increment the counter, `Link`-navigate
   to `/pricing`.
3. **Counter resets → A2 does not persist (expected); the layout re-rendered.**
   Counter survives → the model is wrong for this version; revisit the fork.
4. Delete the probe.

Record the observed result here when run:

> **Probe 1 — A2 (2026-06-15, Next 16.2.9): CONFIRMED A2 does not persist.**
> Client counter inside a co-located `[...slug]/layout.tsx`: incremented to
> **3** on `/probe/a`; a `Link` soft-nav to `/probe/b` (content updated
> without a reload) reset it to **0**. The catch-all-co-located layout
> re-renders on the param change and tears down client state — as predicted.
>
> **Probe 2 — A1 topology (zone-segment layout): CONFIRMED persists in-zone,
> swaps cross-zone.** Counter in a layout at the `[zone]` segment (parent of
> `[...slug]`): `/probe/standard/a` (counter→3) → `/probe/standard/b` kept
> **3** (same zone, layout preserved); → `/probe/checkout/c` reset to **0**
> (zone changed, frame swapped). Exactly the desired behavior.
>
> **Probe 3 — A1 rewrite preservation: CONFIRMED a rewrite keeps the clean URL
> AND preserves persistence.** `middleware` rewrote `/cprobe/a` and `/cprobe/b`
> (clean URLs) → `/probe/standard/*`. Counter→2 on `/cprobe/a`, soft-nav to
> `/cprobe/b` kept **2**, browser URL stayed `/cprobe/b`. So region routing
> delivers clean URLs + persistence together — which is why we built A1
> outright. All probe routes deleted after the runs.
>
> **E2E smoke (real CMS data + `proxy.ts`):** clean `/preview/<t>/about`
> (page assigned `standard`) composed `SITE HEADER → ABOUT BODY → SITE FOOTER`
> under `[data-zone-root="standard"]` with the URL staying clean; unassigned
> `/preview/<t>/bare` → `_self` zone → rendered bare (no chrome). Torn down.

## Implementation (as shipped)

- **`proxy.ts`** (repo root, Node runtime) — matches `/preview/:tenantId/:path*`,
  skips `blog`, looks up the zone via `getPageZone(tenantId, path)` (cheap —
  `select: { layoutSlug }` only), and `NextResponse.rewrite`s to
  `/preview/<tenantId>/<zone>/<path>`. `layoutSlug = null` → the `_self`
  sentinel (`SELF_ZONE` in `lib/cms/pages.ts`; a leading-underscore value
  `validateSlug` can never produce, so no collision with a real zone).
- **`app/preview/[tenantId]/[zone]/layout.tsx`** — reads `zone` from params
  (set by the rewrite, NOT a page lookup — that's what keeps it stable within
  a zone), resolves chrome via `resolveLayoutChrome(tenantId, zone)`, renders
  `RenderProjectFragment` with the page as `config.slotContent`. `_self` /
  missing / non-draft → bare `{children}`.
- **`app/preview/[tenantId]/[zone]/[...slug]/page.tsx`** — unchanged page
  render (content fragment only); `zone` param ignored.
- **Cost:** one extra cheap query per preview request (the proxy's
  `getPageZone`) on top of the page's content read. The render-cache key for
  chrome is `(tenantId, zone[, version])` — independent of the page.
- **Known sharp edge:** manually typing an already-zoned URL
  (`/preview/<t>/standard/about`) double-rewrites (the proxy treats `standard`
  as path). Harmless in practice — browser URLs are always clean (the rewrite
  is invisible; `/api/preview` redirects to the clean path). A guard could
  skip rewriting when the first segment is a known zone, but zones are dynamic
  so it's left as a noted edge.

---

## 2. Slot-boundary representation — already decided by the prep refactor

The prep refactor (2026-06-15) made this decision concrete in code, so this
section ratifies rather than chooses:

- The slot is the existing **`content-slot` component type**
  (`CONTENT_SLOT_TYPE`, single-sourced in
  `lib/plugins/react-renderer/project/types.ts`). A LAYOUT author drops it;
  it is stored in the LAYOUT's `data` like any node.
- At render, **`RenderComponent` substitutes `config.slotContent`** for a
  `content-slot` node (`config` reaches every recursive node, so no marker
  threading). The page content fragment is passed as `config.slotContent`.

**Rejected:** a dedicated `{ type: "content-slot-boundary" }` node inserted by
the resolver. It would require the resolver to mutate the tree and the
renderer to special-case a second type — strictly more moving parts than
"leave the `content-slot` node in place; the renderer fills it."

### Consequence: Phase 2's resolver work shrinks

§14 Bucket 2 originally sketched a `resolveNode` slot branch emitting a
boundary marker. **That branch is unnecessary** under the `config.slotContent`
approach:

- `resolvePageTree` (page content) is **unchanged** — pages contain no
  `content-slot`; a stray one renders `null` (renderer returns
  `slotContent ?? null`), which is harmless.
- `resolveLayoutChrome(tenantId, layoutSlug)` is a **thin composer**:
  `loadTemplate` → wrap the slim body into a project shape → `resolvePageTree`
  (which expands the LAYOUT's header/footer PART `template-ref`s for free and
  merges their styles). The `content-slot` node passes through **untouched**;
  the React render layer fills it via `config.slotContent`.

So Phase 2 is: one thin composer + the nested `layout.tsx` + passing the page
fragment as `config.slotContent`. No new `resolveNode` branch.

---

## 3. Render-path shape Phase 2 should build (A2)

```
app/preview/[tenantId]/[...slug]/
├── layout.tsx   (NEW)
│     const { tenantId, slug } = await params
│     // draft gate mirrors page.tsx so chrome doesn't render on a 404/no-draft
│     if (!(await draftMode()).isEnabled) return <>{children}</>
│     const page = await getPageByPath(tenantId, slug.join("/"))   // React.cache — shared with page.tsx
│     if (!page?.layoutSlug) return <>{children}</>                 // self-contained / no zone
│     const chrome = await resolveLayoutChrome(tenantId, page.layoutSlug)
│     if (!chrome) return <>{children}</>                           // missing zone → bare, no crash
│     return <RenderProjectFragment
│              projectData={chrome}
│              config={{ components: patternComponents, slotContent: children }}
│              rootAttributes={{ "data-zone-root": page.layoutSlug }} />
│
└── page.tsx   (unchanged behavior — renders only the content fragment via PagePreview)
```

Notes for the Phase 2 executor:

- **`getPageByPath` is already `React.cache`-wrapped** — the layout and page
  share one query per request (prep refactor).
- **`RenderProjectFragment` is already extracted** and accepts `config` — pass
  the page's rendered fragment (`children`) as `config.slotContent`. The
  fragment renderer strips the LAYOUT's own wrapper, the same way it does for
  a page.
- **Draft / not-found:** the layout must mirror the page's draft gate so it
  doesn't wrap a `notFound()` body in chrome. Simplest: re-check `draftMode()`
  and bail to bare `{children}`; the page below still owns the real 404.
- **Styles:** chrome styles ride in the fragment `RenderProjectFragment`
  emits; page styles ride in `PagePreview`'s fragment. Cascade order is
  layout-CSS (outer) then page-CSS (inner `{children}`) — which is the
  intended order (page can override chrome). Confirm in the Phase 2 smoke.
- **Caching (later):** `resolveLayoutChrome` keys on
  `(tenantId, zoneSlug, layoutVersion, …refSlugVersions)` — independent of the
  page, which is the instant-publish property. Out of scope until render
  caching lands.

---

## 4. Residual open items (not blocking Phase 2)

- **Posts** (`blog/[slug]`) — same restructure, but posts likely get a fixed
  `singular`-style zone rather than per-post choice. Decide separately
  (`wp-template-hierarchy.md`).
- **Tenant default zone** — `page.layoutSlug ?? tenant.defaultZoneSlug`; a
  one-liner once a tenant-default column exists. MVP: `null` = self-contained.
- **Public render path** — plan 009 inherits this exact A2 structure; its
  two-level cache tags (zone vs page) build on the independence noted above.

---

## Related

- `plans/008-layout-content-slot.md` — the build plan (Phase 2 is gated on
  this memo).
- `docs/reference/templates-followups.md` §14 — Approach A design.
- `docs/reference/header-footer-architecture-options.md` — A vs B, zones,
  the persistence asymmetry.
- `docs/reference/wp-template-hierarchy.md` — region navigation / "App Router
  is our hierarchy."
- `docs/reference/rendering-pipeline.md` — where layout resolution hooks in.
