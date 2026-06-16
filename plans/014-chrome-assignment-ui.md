# Plan 014: Chrome assignment UI (multi-header — Piece 3)

> **Status: NOT STARTED.** Final slice of the multi-header chrome work.
> Pieces 1–2 are SHIPPED (2026-06-16). Effort: M. No schema migration needed —
> the `ChromeAssignment` table already exists.

## Context — where the chrome work stands

The "site owns the frame" model lets each route segment show a different
header/footer. Shipped so far:

- **Piece 1** — transparent-shadow editing of the code-default header/footer in
  the Parts library (Customize / Duplicate / Reset). See
  `lib/cms/template-actions.ts` (`customizeDefaultPart`, `duplicateDefaultPart`)
  and the Parts data table.
- **Piece 2** — `ChromeAssignment(tenantId, segment, headerSlug?, footerSlug?)`
  model (`@@unique([tenantId, segment])`), `lib/cms/chrome.ts`
  (`CHROME_SEGMENTS`, `getChromeAssignment`, `resolveSegmentChrome`), and
  per-segment render via `<SiteChrome segment>` (`site-chrome.tsx`) in
  `(home)/layout.tsx`, `pages/layout.tsx`, `posts/layout.tsx`. Chrome was
  removed from the preview root layout. Resolution chain: assignment slug →
  tenant default slug (`header`/`footer`) → code default (non-breaking).

**The gap (Piece 3):** assignments are **DB-only** today — there is no UI for a
user to choose "posts uses `header-blog`". This piece adds that.

## Scope

1. **Per-segment assignment panel.** For each route segment, a **header
   `Select`** and a **footer `Select`**:
   - Options come from the tenant's parts: `listTemplatesByKind(tenantId, "PART")`
     **filtered by `area`** — header selects list `area:"header"` parts, footer
     selects list `area:"footer"`. (WP model: *area scopes the picker, the
     chosen slug is what's stored* — confirmed.)
   - An empty/"Default" option = inherit the tenant default (slug
     `header`/`footer` → code default), stored as `null`.
   - Segments shown: `home`, `pages`, `posts` (the ones with live per-segment
     layouts). `categories`/`tags`/`authors` exist in `CHROME_SEGMENTS` but
     currently inherit `posts` chrome — surface them only once the archive
     routes are flattened out from under `posts/` (see
     `project_chrome_multi_header` caveat). Until then either hide them or show
     them disabled with a note.

2. **Save action.** A server action that upserts `ChromeAssignment` per
   `(tenantId, segment)` (Prisma `upsert` on the `tenantId_segment` unique).
   `null` slug clears the assignment (inherit default). Bump the relevant cache
   tag if/when chrome resolution is cached.

3. **Extend the slug-rename guard.** `templateRefUsage` (the §4 rename guard,
   `lib/cms/templates.ts` / `template-ref-usage.ts`) scans pages/posts/templates
   for `template-ref` nodes; it does **not** know about chrome assignments. So
   renaming a part assigned to a segment would silently break the assignment.
   Add a probe of `ChromeAssignment` (`headerSlug`/`footerSlug` = old slug) so
   renames surface the conflict. Mirror in the delete-impact logic if desired.

## Open decision — placement

Where the panel lives (pick before building):
- **Dedicated Library sub-page** (e.g. "Site frame" / "Chrome") next to
  Templates / Patterns / Parts — *leaning this*, keeps it with the other
  template surfaces.
- A tenant **settings** page.
- Inline on the Parts page.

## Critical files

- `lib/cms/chrome.ts` — `CHROME_SEGMENTS`, `getChromeAssignment`,
  `resolveSegmentChrome` (the resolver the UI writes for).
- `lib/cms/templates.ts` — `listTemplatesByKind` (populate the selects),
  reserved-slug + `templateRefUsage` rename guard (extend).
- `app/admin/(shell)/tenants/[id]/library/` — where a new sub-page + nav item
  would slot in (mirror the existing per-kind pages).
- A new server action (alongside `lib/cms/template-actions.ts` or a new
  `chrome-actions.ts`) for the upsert.

## Verification

`pnpm typecheck` / `lint` / `format`. In the browser: assign a non-default
header to the `posts` segment via the panel; confirm `/posts/<slug>` renders it
while `/pages/<path>` shows the default (the Piece-2 verification flow). Clear
the assignment → reverts to default. Rename an assigned part → guard blocks /
warns.

## Related

- `project_chrome_multi_header` (memory) — the full Pieces 1–3 story.
- `docs/reference/wp-template-hierarchy.md` — by-slug part reference, area as
  picker scope.
