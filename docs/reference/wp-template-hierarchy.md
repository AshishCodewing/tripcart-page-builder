# WordPress Template Hierarchy — what it is, what we take, what we skip

> **Update (2026-06-15, final): chrome is tenant-level, not per-page.** This
> doc's central thesis stands and is reinforced — we do **not** build the deep
> query-shape hierarchy; the Next.js App Router is our router. The chrome
> *ownership* question churned (B per-page dropdown → A per-page "zones" +
> proxy) and both elaborate designs were **reverted**. Final, shipped model:
> **the site owns one header + one footer per tenant**, stored as
> `Tenant.headerTemplateId` / `footerTemplateId` and rendered once in
> `app/preview/[tenantId]/layout.tsx` (via `resolveTemplateChrome`). No
> `content-slot`, no per-page assignment, no zones, no proxy. The "Mapping to
> this builder" rows below that mention `content-slot` / per-page template
> dropdowns / zones are **superseded** by this tenant-chrome model; the
> hierarchy reasoning (what we skip and why) is unchanged. See
> `templates-followups.md` §14 and `header-footer-architecture-options.md`.

Decision/explainer doc (2026-06-12). Answers: "should the builder implement a
WP-style template hierarchy?" Short version: **the full hierarchy, no — the
Next.js App Router already plays that role. Template parts, already shipped. A
shallow 5-slug layout fallback plus a content slot, yes — and both are already
specced** (`templates.md` §Special template slugs, `templates-followups.md`
§14). This doc captures the reasoning so it doesn't get re-derived.

Sources: WP Themes Handbook (theme-structure + template-parts +
global-settings-and-styles, ingested in the RAG — see
`reference_wp_themes_handbook_rag`).

## How the WordPress template hierarchy works

WordPress has one front controller: every URL hits `index.php`, gets parsed
into a **query type** (single post, page, category archive, author archive,
date archive, search, 404, front page, …), and then WP walks a
**most-specific → least-specific lookup list** for that query type until a
template file exists:

- Single post: `single-{posttype}-{slug}` → `single-{posttype}` → `single` →
  `singular` → `index`
- Category: `category-{slug}` → `category-{id}` → `category` → `archive` →
  `index`
- Page: custom template (user-picked dropdown) → `page-{slug}` → `page-{id}` →
  `page` → `singular` → `index`

Everything terminates at `index.php`, which is why it's the only required
template — the hierarchy guarantees every URL renders *something*. In block
themes the mechanism is identical but templates are `.html` block markup in
`/templates`, and a user-edited template saved in the DB (a `wp_template` row)
**shadows** the theme file of the same name.

**Template parts are orthogonal to the hierarchy.** They are not part of the
cascade — they're includes (`<!-- wp:template-part {"slug":"header"} /-->`)
that templates pull in so header/footer aren't duplicated across `single`,
`archive`, `page`, etc. Same shadowing rule: a DB-edited part beats the
theme's `/parts/header.html`.

### Why WP needs it

Two structural facts about WordPress drive the design:

1. **Content massively outnumbers designs.** 10,000 posts, one `single.php`.
   The cascade lets theme authors add specificity only where they care
   (`category-news.php`) with guaranteed fallback everywhere else.
2. **Themes are decoupled from content.** A post doesn't know what renders
   it; the URL classification decides. The hierarchy *is* WP's router.

## Mapping to this builder

| WP concept | Our equivalent | Status |
|---|---|---|
| Template parts (`/parts`, `wp:template-part`) | `Template` rows with `kind = PART` + `template-ref` component, resolved server-side | **Shipped** |
| DB-over-theme shadowing | Tenant row shadows same-slug global (`ORDER BY tenant_id NULLS LAST`) | **Shipped** |
| Synced patterns (`wp_block`) | `kind = PATTERN, synced = true` | **Shipped** |
| `wp:post-content` (the content hole in a template) | `content-slot` component | **Planned** — `templates-followups.md` §14 |
| Custom templates (per-page template dropdown) | `Page.layoutSlug` + right-panel Select | **Planned** — §14 |
| Shallow hierarchy endpoints (`singular`, `archive`, `404`, `front-page`) | Reserved LAYOUT slugs `home` / `singular` / `archive` / `404` / `error` | **Specced, not built** — `templates.md` §Special template slugs |
| Deep cascade (`category-{slug}` → `category-{id}` → …) | — | **Deliberately skipped** |
| Query-type classification engine | Next.js App Router file-system routing | **Already have it** |

### Why the full hierarchy doesn't fit

1. **We already have a template hierarchy: the Next.js App Router.** WP needs
   the cascade because it has one front controller and rewrite rules; our
   file-system routes *are* the URL-classification layer. The only question
   left after routing is "which user-editable LAYOUT wraps this route's
   content" — a single keyed lookup with a tenant → global → hardcoded
   fallback, not a specificity walk.
2. **Pages invert WP's core assumption.** In WP the template renders the
   content; in this builder each `Page.data` *is* the design. A specificity
   hierarchy over individually-designed pages resolves nothing — there is no
   many-records-one-design problem to solve for Pages.
3. **Posts are the one WP-shaped content type** (many records, one design).
   That's why `singular` is the reserved slug that earns its keep first:
   today `app/preview/[tenantId]/blog/[slug]/page.tsx` renders posts inside a
   hardcoded React `<article>` shell, not a user-editable layout.

This is the same conclusion §14 reached as its resolved design fork: build
WP's **custom-template** model (explicit per-page assignment), not the
auto-matching hierarchy. Hierarchy can layer on later by *computing*
`layoutSlug` from route shape instead of reading a column — same resolver,
different source.

## What remains to build

In priority order (all tracked elsewhere; listed here for the through-line):

1. **`content-slot` component** — the `wp:post-content` analogue. A LAYOUT is
   mechanically identical to a PATTERN until something marks where page/post
   content pours in. This is the real engineering, more than any lookup.
   (§14, scoped: ~20-line plugin + ~25 resolver lines + one nullable column.)
2. **Reserved-slug layout resolution** for the post/archive/404 render paths
   (`templates.md` §Special template slugs). A two-level fallback over five
   fixed keys. Resist adding slug #6 until a concrete need shows up — each
   reserved slug is a renderer↔data contract.
3. **Per-page layout assignment UI** (`Page.layoutSlug` Select) — §14 touch 5.
4. **Defer until asked:** per-*post* template choice, taxonomy-archive
   specificity, tenant-default layout fallback (§14 open question — a
   one-liner later: `page.layoutSlug ?? tenant.defaultLayoutSlug`).

## What we deliberately do not copy from WP

- **The deep specificity chains.** No taxonomy/author/date archive rendering
  exists yet; building lookup lists for them is speculative scaffolding.
- **The file-vs-DB template duality.** WP carries both because themes ship as
  files and user edits live in the DB. We are DB-native; the only split we
  keep is code-defined block primitives vs DB templates (`templates.md`
  §Built-in vs DB globals), which is a different axis.
- **One required catch-all template (`index.php`).** Our hardcoded renderer
  defaults play that role; no user-facing "index" template needed.

## The UX lesson worth importing

The single biggest user confusion in WP's Site Editor is **"am I editing the
page or the template?"** — edits to a template part silently fan out to every
page using it. Our locked `template-ref` + "Edit template" navigation already
handles this for PARTs. Keep the same discipline when LAYOUTs start wrapping
post content: the layout chrome shown around a page/post must be visibly
not-editable-here, with an explicit jump to the template editor. §14's
"editor inline preview deferred" note should adopt this constraint when that
preview lands.

## Related

- `docs/reference/templates.md` — template data model, sync semantics,
  shadowing, reserved slugs.
- `docs/reference/templates-followups.md` §14 — content slot + layout
  assignment design (the buildable slice of this doc).
- `docs/reference/rendering-pipeline.md` — where layout resolution hooks into
  the render path.
- `docs/handbook/templates.md` — onboarding-level overview.
