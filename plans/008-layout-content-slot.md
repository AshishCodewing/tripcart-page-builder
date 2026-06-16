# Plan 008: LAYOUT chrome ownership — Approach A (site/route owns the frame)

> **⚠️ ABANDONED / REVERTED (2026-06-15). Do not execute this plan.** Approach
> A was built (schema `layoutSlug`, `proxy.ts`, `[zone]` routes,
> `content-slot`, `resolveLayoutChrome`) and then fully reverted. The shipped
> model is much simpler: **site chrome = two tenant-assigned templates**
> (`Tenant.headerTemplateId` / `footerTemplateId`) rendered in
> `app/preview/[tenantId]/layout.tsx` via `resolveTemplateChrome`; preview
> routes follow next-wp structure (`pages/[...slug]`, `posts/[slug]`, …).
> See the reversal notes in `docs/reference/templates-followups.md` §14 and
> `docs/reference/layout-render-fork.md`. This plan is retained for history.

> **Rewritten 2026-06-15 for Approach A.** This supersedes the prior
> Approach-B version of this plan (each page baked the whole document;
> render-time server-side tree-splice via `resolvePageWithLayout`). The
> chrome-ownership decision flipped B → A — see
> `docs/reference/header-footer-architecture-options.md` (product rationale)
> and `docs/reference/templates-followups.md` §14 (the A design). **Do not
> implement the B design**; §14's "Superseded — the Approach B design"
> subsection records it as the path not taken.
>
> **Executor instructions**: This plan is part design-spike, part build.
> Phase 1 is no-regret and mechanical — build it. Phases 2–3 require the
> Phase 0 spike memo to be written and approved before you touch the render
> path. Honor STOP conditions. Update the status row in `plans/README.md`
> when a phase lands.
>
> **Required reading before Phase 0**: `docs/reference/templates-followups.md`
> §14 (A design — on any conflict between that doc and this plan, STOP and
> report; the doc wins), `docs/reference/header-footer-architecture-options.md`
> (why A, the zones model), `docs/reference/wp-template-hierarchy.md` (the
> "App Router is our hierarchy" through-line and the not-editable-here UX
> lesson), and `docs/reference/templates.md` for the template model.
>
> **Drift check (run first)**: `git diff --stat ae527df..HEAD -- prisma/schema.prisma lib/cms lib/plugins "app/preview" components/page-builder "app/admin/(editor)/pages"`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2 (direction — maintainer-selected)
- **Effort**: M (was M→L when a data migration was in scope; that step is
  removed — see below. A adds a render-path restructure + an editor-preview
  surface)
- **Risk**: MED. The render path changes shape (nested layout) — that's the
  real work. **The data-migration risk is gone**: existing `Page.data` is
  disposable, and the chrome audit (`scripts/audit-page-chrome.ts`, run
  2026-06-15) found **0 pages encode chrome via shared PART templates** (it's
  baked raw per page), so there is nothing cleanly extractable and nothing to
  migrate — existing pages are reset, not transformed. Further de-risked by
  the codebase already being largely A-shaped (see "Current state"). Mitigated
  by phasing — Phase 1 ships no-regret foundation behind no behavior change;
  Phases 2–3 gate on a spike memo.
- **Depends on**: plans/001-verification-baseline.md (resolver
  characterization tests MUST exist and pass before touching `templates.ts`).
- **Category**: direction
- **Planned at**: commit `ae527df`; rewritten for A at the current HEAD.

## Why this matters

`kind: LAYOUT` is mechanically identical to `PATTERN` until something makes it
a page-shell. WordPress reserves a hole (`wp:post-content`) and the page pours
in; the Next.js App Router already plays WP's hierarchy/router role
(`wp-template-hierarchy.md`). **Approach A leans into that**: a LAYOUT becomes
a persistent frame rendered by a layout segment, the page owns only its
content fragment poured in as React `children`. This buys the site-owns-chrome
properties B can never offer — chrome persists across navigation, a header
edit publishes instantly instead of forcing every page to refresh a baked
copy — at the cost of arbitrary per-page chrome (recovered for common cases
via a fixed **zone** menu: Standard / Checkout / Bare).

## Current state

### The codebase is already largely A-shaped (verified 2026-06-15)

Three primitives A needs already exist — the render restructure is additive,
not a rewrite:

- **`PagePreview` already renders the page as a content *fragment*.** It
  strips the `<body>`/wrapper and renders `root.components` inline
  (`components/page-builder/page-preview.tsx`), emitting page-scoped CSS as a
  `<style>`. A's "page owns only its content" is already how preview renders.
  Generalize this into a shared "render a resolved tree fragment + its CSS"
  component so the zone layout and the content page share one path (plan 009
  already anticipated PagePreview being "renamed/shared").
- **`RenderComponent` already has a `children` prop + config flow.** It merges
  injected children (`const merged = [...childNodes, children]`,
  `render-component.tsx:60`) and `config` (`RendererReactOptions`) reaches
  every recursive node. So the slot→`children` injection is ~3 lines: add
  `slotContent?: ReactNode` to the renderer config and, in `RenderComponent`,
  `if (type === CONTENT_SLOT_TYPE) return config?.slotContent ?? null`. No
  threading — `config` already flows down. (`RenderPage` already uses the
  `children` prop today for `<style>` / `bodyAfter` slots.)
- **CSS layering already matches A.** `app/preview/[tenantId]/layout.tsx`
  composes the tenant theme layer above the page's own CSS; A's chrome CSS is
  a third layer in the same established pattern.

A small pre-step worth doing in Phase 2: wrap the page fetch in `React.cache`
so the new `[...slug]/layout.tsx` and `page.tsx` (both reading the same
`(tenantId, path)` row under A2) share one query.

### Render path — `app/preview/[tenantId]/`

- `layout.tsx` is already a persistent per-tenant layout: it emits the
  compiled theme stylesheet `<link>` and renders `{children}`. **This is
  already the A pattern at the theme level** — A extends the same idea to
  chrome. There is **no** layout segment at `[...slug]/` today.
- `[...slug]/page.tsx:42` reads the page by `(tenantId, path)` and calls
  `resolvePageTree(tenantId, page.data)` → one `ProjectDefinition` →
  `<PagePreview projectData=… config={{ components: patternComponents }} />`.
  Draft-mode gated (`notFound()` when off).
- `blog/[slug]/page.tsx` renders posts in a hardcoded React `<article>`
  shell (per `wp-template-hierarchy.md`, the `singular` reserved-slug
  candidate).

### Resolver — `lib/cms/templates.ts`

- `TEMPLATE_REF_TYPE = "template-ref"` (139), `SLUG_ATTR = "data-slug"` (140),
  `MAX_DEPTH = 16` (147).
- `type TemplateBody = { component; styles }` (162); `slimTemplateProject`
  (178); `unwrapTemplateRoot` imported from `@/lib/cms/template-shape` (19).
- `type ResolveCtx` (194) — `{ tenantId, cache, visiting, styles, stylesAdded }`.
- `resolvePageTree(tenantId, data)` (222) → unwraps root, `resolveNode`,
  returns input unchanged when nothing resolved else rebuilds with resolved
  root + merged styles.
- `resolveNode(ctx, node, depth)` (258): depth guard (263) → `template-ref`
  branch (265: slug → `loadTemplate` via cache → slim/legacy body →
  `unwrapTemplateRoot` → recursive resolve under `visiting` cycle guard →
  per-slug style dedupe) → else recurse `node.components`.
- `placeholder(reason)` (319): `{ tagName: "div", attributes: { "data-template-placeholder": reason }, components: [] }`.
- `loadTemplate(tenantId, slug)` (89): tenant-first/global-fallback.
- `templateRefExists(slug)` (116): raw SQL, three `jsonb_path_exists` EXISTS
  clauses over `pages`/`posts`/`templates`.

### Editor — `components/page-builder/editor-shell.tsx`

- Plugins array in `buildGjsOptions` (~345): `…, templateRefPlugin(templates),
  templateBlocksPlugin(templates), …`, called from a `React.useMemo` (~637).
- Clone exemplar for the slot: `lib/plugins/template-ref.ts` (addType,
  locked placeholder chrome via protected CSS, exported type constants).
  Read it fully before writing the slot plugin.

### Other

- `lib/cms/page-actions.ts` `savePage(id, form)` (41) — metadata fields with
  `existing`-fallbacks; bumps cache tags.
- Right panel `PageOnlyFields` (right-panel.tsx ~227) — Parent `Select`; page
  edit route already fetches `listTemplates(page.tenantId)`.
- `listTemplatesByKind(tenantId, kind)` exists (templates.ts:71).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Migration | `pnpm prisma migrate dev --name add_page_zone` | exit 0, new folder |
| Generate | `pnpm prisma generate` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | all pass incl. new resolver cases |
| Format | `pnpm format` | exit 0 |

`pnpm prisma migrate dev` needs a local `DATABASE_URL`. If no DB is reachable,
use `--create-only` and STOP-report that it's unapplied.

---

## Phase 0 — render-fork spike (BLOCKS Phases 2–3; produce a memo)

**DONE (2026-06-15): `docs/reference/layout-render-fork.md`.** Decisions:
- **A2 (dynamic `[...slug]/layout.tsx`) for the MVP** — correct render +
  instant-publish caching. It provably does **not** persist interactive chrome
  state across navigation (the layout sits *at* the changing `[...slug]`
  segment, so it re-renders per nav); we have no interactive chrome element
  yet, so that's an accepted MVP limitation. **A1 (region routing via a
  zone→route rewrite) is the persistence follow-on**, sequenced only when a
  persistent interactive element is demanded. The memo includes a 15-min probe
  to confirm the persistence behavior empirically before Phase 2 builds.
- **Slot = the existing `content-slot` node + the renderer's
  `config.slotContent`** (already built in the prep refactor). **No
  `content-slot-boundary` type and no `resolveNode` slot branch** — this
  shrinks Step 2.1 (see the note there).

The original spike framing follows for reference.

Write `docs/reference/layout-render-fork.md` (or extend §14) deciding **A2 vs
A1** for the MVP:

- **A2 — dynamic nested layout (recommended MVP).** Add
  `app/preview/[tenantId]/[...slug]/layout.tsx` that reads `(tenantId, path)`,
  loads the page's zone, resolves the chrome (`resolveLayoutChrome`), and
  wraps `{children}`. The page renders only its content fragment.
  - **Verify the persistence claim against the live Next.js version**
    (16.2.x): does the `[...slug]/layout.tsx` instance stay mounted (preserve
    client state) across `/a → /b` client navigations, or does the per-path
    param change force a re-render? Document the answer — it determines how
    much of A's "open drawer survives navigation" benefit A2 actually
    delivers. If A2 cannot persist at all, say so plainly; A2 may still be
    the right MVP for correct render + instant publish, with persistence
    deferred to A1.
- **A1 — region routing (persistence follow-on).** Encode the zone in the
  route (route groups or a rewrite) so the zone layout sits **above** the
  changing `[...slug]` segment and stays mounted across same-zone
  navigations. Heavier; only needed when open-state-across-nav is demanded.
  Sketch the routing shape; do **not** build it this plan unless the operator
  asks.

The memo must also fix:
- **The slot-boundary representation** in the resolved tree (Phase 2): a
  dedicated `{ type: "content-slot-boundary" }` node the React renderer maps
  to `children`, vs reusing a `placeholder()` marker. Decide and record.
  (Recommended: inject via the renderer `config.slotContent` — `config`
  already reaches every node, so no marker threading is needed; see "Current
  state".)

(No data-migration decision: existing `Page.data` is disposable and the
chrome audit found nothing extractable — see Status. Phase 3 seeds a fresh
Standard zone instead of migrating.)

**STOP** and report the memo for approval before Phase 2.

---

## Phase 1 — no-regret foundation (build now; no behavior change)

Nothing here changes rendered output. Safe to land independent of the spike.

### Step 1.1: Zone column on `Page`

Add to the `Page` model (after the `parentId`/`parent`/`children` block, keep
the comment style):

```prisma
  // Zone / LAYOUT assignment (docs/reference/templates-followups.md §14,
  // Approach A). Stored as a slug (not an FK) to inherit the
  // tenant-first/global-fallback shadowing `loadTemplate` gives every
  // template reference. null = the tenant default (Standard zone).
  layoutSlug  String?
```

Run `pnpm prisma migrate dev --name add_page_zone` + `pnpm prisma generate`.

**Verify**: `grep -n "layoutSlug" prisma/migrations/*add_page_zone/migration.sql`
→ one `ALTER TABLE "pages" ADD COLUMN`; `pnpm typecheck` exit 0.

### Step 1.2: `content-slot` editor plugin

Create `lib/plugins/content-slot.ts`, cloned structurally from
`lib/plugins/template-ref.ts` (read it first — match doc-comment style,
`addType` usage, protected-CSS placeholder chrome):

- **Type constant single-sourced.** **DONE (prep refactor 2026-06-15):**
  `CONTENT_SLOT_TYPE = "content-slot"` lives in the renderer
  (`lib/plugins/react-renderer/project/types.ts`, re-exported from
  `…/project`) — the lowest layer, so the resolver (`lib/cms/templates.ts`),
  the plugin, and the renderer all import *down* into it (no layering
  inversion; no grapesjs/prisma runtime dragged across). This supersedes the
  original plan note that put it in `lib/cms/template-shape.ts` (which would
  have made the renderer depend *up* into cms).
- `contentSlotPlugin({ enableBlock }: { enableBlock: boolean })`:
  - `editor.Components.addType("content-slot", …)`: `tagName: "div"`, marker
    attr `data-content-slot`, `draggable: true, droppable: false, editable:
    false, layerable: true`, label "Page content", locked dashed-box
    placeholder chrome (follow template-ref's `PLACEHOLDER_CSS` +
    protected-style injection).
  - When `enableBlock`: `editor.Blocks.add("content-slot", { label: "Page
    content", category: "Layout", content: { type: "content-slot" }, media:
    <inline SVG> })`.
  - **One-slot rule**: on `block:drag:stop` / `component:add`, if a second
    `content-slot` appears, remove the new one + emit a GrapesJS notice
    (~10 lines). If it balloons, ship without the guard and note it.

**Verify**: `pnpm typecheck && pnpm lint` exit 0.

### Step 1.3: Wire the slot plugin in the editor shell

In `components/page-builder/editor-shell.tsx`:

- `buildGjsOptions` gains `enableSlotBlock: boolean`, threaded from the
  component: the editor edits a LAYOUT when `content.kind === "template" &&
  content.template.kind === "LAYOUT"` (confirm the exact `TemplateContent`
  shape in `components/page-builder/types.ts` first).
- Add `contentSlotPlugin({ enableBlock: enableSlotBlock })` AFTER
  `designSystemPlugin` (same ordering rationale as templateRefPlugin — keep
  the comment style at ~345-376).
- **The type registers for ALL content kinds** (a LAYOUT's saved tree
  contains the slot and must render in any canvas); only the *Block* is gated.
- Update the `React.useMemo` deps.

**Verify**: `pnpm typecheck && pnpm lint` exit 0.

### Step 1.4: `templateRefExists` covers zone assignments

Extend the raw query (`templates.ts:116`) with a fourth clause:

```sql
OR EXISTS (SELECT 1 FROM "pages" WHERE "layoutSlug" = ${slug})
```

(plain text param, NOT the jsonb `vars`). Update the doc comment.

**Verify**: `pnpm typecheck` exit 0. If plan-001's suite mocks `$queryRaw`,
extend the mock; else note it's covered by the Phase 3 rename-guard manual
check.

**Phase 1 done**: foundation in place, zero rendered-output change. Update the
README row to `IN PROGRESS (Phase 1 done)`.

---

## Phase 2 — render restructure (GATED on Phase 0 memo)

**DONE (2026-06-15), then upgraded A2 → A1.** `resolveLayoutChrome` (a thin
`resolvePageTree` wrapper; `content-slot` rides through untouched, returns
`null` on missing/empty zone) landed in `lib/cms/templates.ts` with 5 resolver
tests; `page.tsx` already rendered only the content fragment.

The chrome layout shipped first as **A2** (`[...slug]/layout.tsx`) then was
**replaced by A1 region routing** once three browser probes cleared it (see
`docs/reference/layout-render-fork.md`): the A2 layout sits at the changing
segment so it can't persist chrome state; A1 puts the zone layout *above* the
page segment and rewrites clean URLs to it. As shipped:
`proxy.ts` (Node runtime) rewrites `/preview/<t>/<path>` →
`/preview/<t>/<zone>/<path>` (zone = `Page.layoutSlug`, `_self` sentinel for
null); `app/preview/[tenantId]/[zone]/layout.tsx` resolves the zone chrome and
injects the page via `config.slotContent`;
`app/preview/[tenantId]/[zone]/[...slug]/page.tsx` renders the content
fragment. **E2E smoke verified** (real CMS data + proxy): a clean URL composes
`header → content → footer` under `[data-zone-root]` with the URL staying
clean; an unassigned page → `_self` → bare (non-breaking). Persistence across
same-zone navigation confirmed by probe (clean-URL rewrite preserves the zone
layout's client state). typecheck / lint / 151 tests green.

This delivers the §14 "persistent interactive chrome" benefit that the memo
had originally deferred — the Phase-2 caveat is resolved.

### Step 2.1: Resolver — `resolveLayoutChrome` (test-first)

> **Simplified by the Phase 0 memo.** The slot is filled at the React-render
> layer via `config.slotContent` (already built), NOT by a `resolveNode`
> branch. So there is **no** slot-boundary marker and **no** change to
> `resolveNode`/`resolvePageTree`. The `content-slot` node passes through the
> resolver untouched; `RenderComponent` substitutes `config.slotContent` for
> it at render. This step is now just the thin `resolveLayoutChrome` composer.

**2.1a. Extend the plan-001 resolver tests first** (fail until 2.1b), modeled
on the existing `project()` / `ref()` fixtures:

1. `resolveLayoutChrome(tenantId, "standard")` for a LAYOUT `{ component:
   { tagName: "div", components: [header-ref, { type: "content-slot" }, footer-ref] } }`
   → resolved tree with header/footer PART contents expanded **and the
   `content-slot` node left in place, untouched** (A fills it at render via
   `config.slotContent`, not in the resolver).
2. Missing layout slug → returns `null` (documented bail value) so the render
   path can fall back to bare page (no throw).
3. Style merge: the chrome result carries the LAYOUT's own + its PARTs' styles
   (independent of any page styles — page styles merge at the render layer).
4. `resolvePageTree` is **unchanged** — assert a page resolves byte-identical
   to today, and that a stray `content-slot` in page data passes through
   without crashing (it renders `null` at the render layer).

(No "slot-less LAYOUT" resolver case — slot-less detection, if wanted, is a
save-time editor warning per §14, not a resolver concern.)

**2.1b. Implement in `lib/cms/templates.ts`:**

- New exported `resolveLayoutChrome(tenantId, layoutSlug)`: `loadTemplate` →
  slim/legacy body read + `unwrapTemplateRoot` → wrap into the project shape →
  `resolvePageTree` (PART `template-ref`s expand + styles merge for free) →
  return the resolved `ProjectDefinition`, or `null` when the layout is
  missing/empty. The `content-slot` node rides through untouched. **Do NOT**
  splice page content here — that is the B design and is explicitly not used.
- No `resolveNode` edit and no `CONTENT_SLOT_TYPE` import are needed here (the
  renderer owns the slot; see the Phase 0 memo + "Current state").

**Verify**: `pnpm test` → 2.1a cases pass; pre-existing resolver tests
untouched and green. **If any existing resolver test needs editing to stay
green, STOP** — that's an unintended behavior change.

### Step 2.2: Nested-layout render path (per the Phase 0 memo)

Implement the memo's chosen fork (A2 expected):

- Add `app/preview/[tenantId]/[...slug]/layout.tsx`: read `(tenantId, path)`,
  load the page's `layoutSlug`, `resolveLayoutChrome`, render the chrome with
  the page content (`{children}`) dropped at the boundary. Missing layout →
  render `{children}` bare. Slot-less layout → render chrome + a dev-visible
  warning marker (don't silently drop content).
- Modify `[...slug]/page.tsx`: render only `resolvePageTree(tenantId,
  page.data)` (the content fragment) via `<PagePreview>`. Select `layoutSlug`
  if a `select` is added.
- The React renderer must map the slot-boundary marker to `children`. Locate
  where `<PagePreview>` / the project renderer materializes the tree and add
  the boundary handling (coordinate with `lib/plugins/react-renderer/`).

**Verify**: `pnpm typecheck && pnpm test` exit 0. Manual smoke (include in
report): a LAYOUT with header + "Page content" + footer, a page assigned to
it, draft preview shows header + page content + footer; unassign → bare.

---

## Phase 3 — A-specific surfaces (GATED on Phase 2)

### Step 3.1: Seed the Standard zone LAYOUT (no migration)

**There is no data migration.** Existing `Page.data` is disposable and the
chrome audit (`scripts/audit-page-chrome.ts`) found 0 pages encoding chrome
via shared PARTs — nothing to extract. Existing pages are reset, not
transformed. The corollary is that the **zone library starts empty**, so the
first concrete artifact is authoring a zone:

- In the LAYOUT editor (Phase 1 surfaces), author a **Standard zone** LAYOUT:
  a header PART `template-ref` + a `content-slot` + a footer PART
  `template-ref`. Save it. This exercises the full no-regret authoring flow
  end-to-end and gives Phase 2's render path something real to compose.
- Make it the tenant default (the zone a `layoutSlug = null` page falls back
  to — see Maintenance notes).
- Optionally seed Checkout (slim header, no nav) and Bare (no chrome) zones
  once Standard renders correctly.

**Verify**: the seeded Standard LAYOUT loads in the editor, shows its
`content-slot`, and a page assigned to it renders header + page content +
footer through the Phase 2 render path. Re-run `pnpm audit:chrome` if you want
to confirm zone refs now appear.

### Step 3.2: Editor inline preview — page inside its frame

Apply the §7-style inline-resolve to the **chrome** so the LAYOUT renders
around the page fragment in-canvas. Per `wp-template-hierarchy.md`'s UX lesson:
the chrome must be **visibly not-editable-here**, with an explicit "Edit
template" jump (mirror the locked `template-ref` discipline). Now in-scope
(was deferred under B).

### Step 3.3: Zone-assignment UI

- `components/page-builder/types.ts`: `PageContent` gains `zoneOptions:
  Array<{ slug: string; title: string }>` (the fixed zone set, each a LAYOUT).
- `app/admin/(editor)/pages/[id]/edit/page.tsx`: build it from the fetched
  `templates` filtered to `kind === "LAYOUT"` (the product-shipped zone set).
- `right-panel.tsx` `PageOnlyFields`: below Parent, add a "Layout / Zone"
  `Select` `name="layoutSlug"`, `defaultValue={content.page.layoutSlug ?? ""}`,
  first item `<SelectItem value="">— Standard (tenant default) —</SelectItem>`,
  then one per zone. Match the Parent select's markup/sizing.
- `lib/cms/page-actions.ts` `savePage`: read `layoutSlug` (absent = preserve,
  empty = null), validate it resolves to a `kind: "LAYOUT"` template via
  `loadTemplate`, include in the update.

**Verify**: `pnpm typecheck && pnpm lint && pnpm test` exit 0.

---

## Step 4: Documentation sync

Update §14's status line in `docs/reference/templates-followups.md` to
shipped-with-date + a one-line deviation list. Reconcile
`docs/reference/wp-template-hierarchy.md` — its "Mapping to this builder" rows
and the "custom-template, not hierarchy" conclusion were written for B; note
that chrome ownership is now Approach A (zones, route-owned frame) and that
the `content-slot` / `Page.layoutSlug` rows shipped under A.

**Verify**: `grep -n "Status:" docs/reference/templates-followups.md | head`
shows §14 updated.

## Done criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` all exit 0
- [ ] Phase 0 memo exists and was approved before Phase 2 began
- [ ] Migration(s) exist and apply clean
- [ ] `content-slot` type constant single-sourced in `template-shape.ts`
      (`grep -n "content-slot\|CONTENT_SLOT" lib/cms/template-shape.ts lib/plugins/content-slot.ts lib/cms/templates.ts`)
- [ ] `resolveLayoutChrome` resolves chrome with the slot as a `children`
      boundary (NOT a splice); `resolvePageTree` content path unchanged
- [ ] `app/preview/[tenantId]/[...slug]/layout.tsx` renders chrome around
      `{children}`; `page.tsx` renders only the content fragment
- [ ] A page assigned a missing layout renders bare (no crash)
- [ ] A seeded Standard zone LAYOUT renders header + page content + footer
      through the Phase 2 render path (no migration step required)
- [ ] `plans/README.md` row updated; §14 + `wp-template-hierarchy.md` synced

## STOP conditions

- Plan 001's resolver tests don't exist / don't pass at your start commit.
- §14 (A) of `templates-followups.md` changed in a way that conflicts with
  this plan (the doc wins; report).
- You're about to start Phase 2/3 without an approved Phase 0 memo.
- `buildGjsOptions` / the plugins array has been restructured beyond
  recognition (editor-shell is the highest-churn file).
- The slot plugin or one-slot guard requires modifying `template-ref.ts` or
  `designSystemPlugin`.
- Any pre-existing resolver test needs modification to stay green.
- `pnpm prisma migrate dev` cannot reach a local DB (use `--create-only`,
  report).

## Maintenance notes

- **B is the path not taken.** `resolvePageWithLayout` (single merged tree) is
  not used under A — composition is at the React-layout level. §14's
  "Superseded" subsection has the B detail if ever needed.
- **A1 region routing** (true open-state-across-nav persistence) is the
  follow-on increment after the A2 MVP — sequence when demanded.
- **Posts**: leaning toward a fixed `singular`-style zone rather than per-post
  choice (`wp-template-hierarchy.md`); the blog route restructure mirrors
  Phase 2 but is out of scope here.
- **Render caching**: chrome resolves independently of the page, so a chrome
  edit invalidates one cache entry (`(tenantId, zoneSlug, layoutVersion)`),
  not every page — A's instant-publish property. Wire when caching lands.
- **Tenant default zone**: `page.layoutSlug ?? tenant.defaultZoneSlug` is a
  one-liner later.
