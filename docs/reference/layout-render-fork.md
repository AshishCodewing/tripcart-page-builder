# Layout render fork — Phase 0 spike memo (Approach A)

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

## TL;DR (the decisions)

- **Build A2 for the MVP** — a dynamic `app/preview/[tenantId]/[...slug]/layout.tsx`
  that resolves the page's zone chrome and wraps `{children}`. It delivers
  correct rendering and the instant-publish caching win. **It does NOT
  persist interactive chrome state across navigation** (open cart drawer
  survives a page change) — and per the reasoning below, it provably can't,
  because the layout sits *at* the changing route segment.
- **A1 (region routing) is the persistence follow-on**, sequenced only when a
  persistent interactive chrome element (e.g. a cart drawer that stays open
  across navigation) is actually demanded. A1 needs a rewrite layer mapping
  page → zone so the zone layout sits *above* the changing segment.
- **The slot is the existing `content-slot` node + the renderer's
  `config.slotContent`** (already built in the prep refactor). **No
  `content-slot-boundary` type, and no `resolveNode` slot branch is needed.**
  This shrinks Phase 2's resolver work to a thin `resolveLayoutChrome`
  composer.

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

> **Probe result (2026-06-15, Next 16.2.9):** CONFIRMED — A2 does not persist.
> Isolated route `app/probe/[...slug]/{layout,page,counter}.tsx`: a client
> counter inside the co-located `[...slug]/layout.tsx`. On `/probe/a` the
> counter was incremented to **3**; a `Link` soft-navigation to `/probe/b`
> (the page content updated `path:a → path:b` without a full reload) reset the
> counter to **0**. So the catch-all-co-located layout re-renders on the param
> change and tears down its client state — exactly the predicted behavior.
> A2 ships correct render + instant-publish; persistent interactive chrome
> needs A1. Probe route deleted after the run.

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
