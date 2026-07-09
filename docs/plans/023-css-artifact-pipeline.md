# 023 — Publish-time CSS artifact pipeline

**Status:** SHIPPED 2026-07-09.

## Why

The public-render design (`docs/public-render-design.md`) picked **Option A**
— public routes in this repo, CSS stringified from project JSON at render
time and inlined as a hoistable `<style>` — and deferred **Option B**, a
separate read-only renderer deployment that consumes static artifacts. This
pipeline future-proofs for Option B *without* changing Option A: it bakes a
compiled CSS artifact onto every entity at write time so a future renderer
can link a stylesheet instead of importing the compiler, and exercises the
serving contract end-to-end via an immutable `.css` route in this repo.

Option A serving is untouched — preview pages still render via the inline
hoisted `<style>` from `RenderProjectFragment`.

## Data model

Nullable columns (migration `20260709083313_add_compiled_css_artifacts`):

- `Page.css` / `Page.cssHash`, `Post.css` / `Post.cssHash`,
  `Template.css` / `Template.cssHash`
- `Tenant.themeCss` / `Tenant.themeCssHash`

`css`/`themeCss` is the compiled CSS string; `cssHash`/`themeCssHash` is
`cssContentKey(css)` (FNV-1a base36 — the same hash the hoistable `<style>`
uses for its `href`).

## Invariants

- **The artifact mirrors the `data` column.** Every write that sets `data`
  re-bakes `css`/`cssHash` in the same update. Compilation happens on *every*
  `data` write, including DRAFT saves — the future renderer gates
  publication on `status`, not on artifact presence, so DRAFT artifacts are
  simply unreferenced.
- **`""` vs `null`.** An entity whose `data` went through the pipeline always
  has a *string* artifact — `""` when it has no rules (a real, servable empty
  stylesheet). `null` means the row predates the pipeline; the serving route
  404s and the fix is `pnpm backfill:css`, never lazy compilation in a public
  read path.
- **Artifacts are UNRESOLVED / per-entity.** A page's `css` contains only the
  page's own rules; template-ref styles stay on their `Template.css`. This
  preserves the independent-chrome / instant-publish property (editing a
  shared header re-bakes only that Template row, not every consuming page). A
  future renderer resolves template-refs, then composes page CSS + each
  resolved part's CSS, treating a missing part artifact as empty (`""`).
- **Protected (theme) rules are stripped** from content artifacts via
  `filterProtectedStyles` — theme CSS lives only in `Tenant.themeCss`.

## Implementation

- `lib/cms/css-artifacts.ts` — `compileCssArtifact(data) → { css, cssHash }`.
  Pure: `filterProtectedStyles` + `rulesToCss` + `cssContentKey`. Accepts
  both full `ProjectData` (Page/Post) and the slim template body
  `{ component, styles }` — both carry a top-level `styles` array.
- `lib/cms/actions-shared/draft-data.ts` — `buildDraftDataUpdate` now spreads
  the artifact into its data-present branch, so `savePage` / `savePost` /
  `saveTemplate` all bake on save through one point.
- Template create/duplicate paths that seed non-empty `data`
  (`createTemplateFromSelection`, `customizeDefaultPart`,
  `duplicateDefaultPart`, `duplicateTemplate`) bake/copy the artifact so a
  never-resaved part still serves. Blank-seeded paths (`createTemplate`,
  `customizeDefaultLayout`, `duplicateBuiltinPattern`) leave it `null` until
  the first Save — a blank row has no CSS to serve.
- `lib/cms/tenant-actions.ts` — `updateTenantTheme` bakes `themeCss` /
  `themeCssHash` alongside the `themeVersion` bump. The preview theme route is
  unchanged (still compiles on demand).
- `scripts/backfill-css-artifacts.ts` (`pnpm backfill:css`) — idempotent;
  bakes only `null` rows. Tenant themes mirror `getTenantTheme`'s `{}` →
  `defaultTheme` sentinel.

## Serving

`GET /api/css/{kind}/{id}/{cssHash}/styles.css`, kind ∈ `page|post|template`.
The `{cssHash}` segment is a pure cache-buster — the handler always serves the
row's *current* artifact. Renderers read `cssHash` from the row and emit the
versioned URL, so it rotates on every edit and the old immutable response is
abandoned (same contract as the theme route). `null` artifact or unknown
kind/id → 404. Response headers:
`content-type: text/css; charset=utf-8`,
`cache-control: public, max-age=31536000, immutable`.

The tenant theme keeps its own route (`/api/preview/theme/...`);
`Tenant.themeCss` is for the future renderer, not this handler.

## Consuming the artifacts

Nothing serves the artifacts yet — Option A preview still renders inline. A
minimal public route (`app/sites/[tenantId]/`) that linked them as immutable
`<link>`s was built and verified end-to-end (theme + page + per-template
artifacts composed in cascade order, no inline `<style>`), then removed once
the contract was proven. The real consumer is the deferred public renderer in
`docs/public-render-design.md`; when it lands it will need the resolver to
expose which template slugs a page touched (the artifacts are unresolved, so
each referenced template's CSS links separately) — that provenance was
prototyped here and can be re-added against a live caller.
