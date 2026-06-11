# Templates

How the builder models reusable content units (page layouts, section patterns, header/footer chrome) and how Pages reference them at render time.

## Overview

A `Template` is a reusable content unit — a GrapesJS subtree (components + styles) stored once and either **copied** into consuming Pages on insert, or **referenced** and resolved at render. One table, one enum, one toggle covers four practical use cases:

| Use case | `kind` | `synced` | Behavior |
|---|---|---|---|
| Page layout / starting point | `LAYOUT` | `false` | Copy on insert; user customizes from there |
| Section pattern / starting point | `PATTERN` | `false` | Copy on insert |
| Synced pattern (edit once, propagate) | `PATTERN` | `true` | Insert as ref; resolved at render |
| Header / footer / sidebar | `PART` | `true` (always) | Insert as ref; resolved at render |

The design is informed by WordPress block themes (templates / template parts / patterns + `wp_block` synced patterns) and by Next.js's layout/page split. We took the WP shape for the data model and the Next.js naming for clarity:

- A `LAYOUT` template is the Next.js-`layout.tsx` analogue — a page wrapper with a content slot, typically referencing one or more `PART` templates.
- A `PART` template is the React-component-you-import-many-places analogue — `<SiteHeader />`, `<SiteFooter />`.
- A `PATTERN` template is a section-level starting point (or, when synced, a "synced pattern" in WP terms).

## Why one table

Earlier sketches split this into `Template`, `Pattern`, and `Fragment` tables. They were collapsed because:

1. The persistence shape is identical — every kind is a GrapesJS subtree with a slug, a title, and a tenant.
2. The "convert any selection to a pattern" UX requires moving rows between kinds (or copying between tables). Same-table conversion is a single `UPDATE`.
3. The sync toggle is an orthogonal flag, not a separate kind — so trying to encode `SYNCED_PATTERN` vs `PATTERN` as separate kinds doubles the table count for no gain.
4. WordPress itself collapsed these in practice: `wp_block` covers both unsynced and synced patterns; `wp_template_part` differs only by carrying an `area` tag.

## Schema

See `prisma/schema.prisma`. The relevant model:

```prisma
enum TemplateKind {
  LAYOUT    // page-shaped starting point (Next.js layout)
  PATTERN   // section-scope starting point
  PART      // area-tagged reusable chrome
}

model Template {
  id          String        @id @default(cuid())
  tenantId    String?       // null = global library; non-null = tenant-scoped
  tenant      Tenant?       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  slug        String
  kind        TemplateKind
  area        String?       // only when kind = PART
  synced      Boolean       @default(false)
  title       String
  description String?
  data        Json          @default("{}")
  preview     String?
  status      ContentStatus @default(DRAFT)
  publishedAt DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@unique([tenantId, slug])
  // + raw partial index `(slug) WHERE tenantId IS NULL` (see migration)
  @@index([tenantId, kind])
  @@map("templates")
}
```

Two non-obvious bits:

- **Slug uniqueness uses two indexes.** Prisma's `@@unique([tenantId, slug])` covers the tenant-scoped composite — `(tenantId='t1', slug='header')` duplicates within a tenant are blocked. But Postgres treats NULL as distinct, so the composite alone would let two globals (`tenantId IS NULL`) share a slug. A raw **partial unique index** `(slug) WHERE tenantId IS NULL` (added in the migration SQL) plugs that gap. Prisma 7 can't express partial conditions on `@@unique`, so this lives only in the migration. Works on any Postgres version (the earlier sketch's `NULLS NOT DISTINCT` would have required Postgres 15+).
- **`tenantId String?`** — null means "global library row, available to all tenants." See [Global library](#global-library) below.

## Insert behavior

When the editor drops a template into a Page, the GrapesJS Block created for that template runs an `onClick` (or the user drags it onto the canvas) that produces one of two outcomes based on `synced`:

### `synced = false` — copy

The template's `data` subtree is parsed and **inlined** into the Page's component tree as plain components. The Page now owns the copy. Future edits to the source template do not affect this Page. This is the default GrapesJS Block behavior.

### `synced = true` — reference

A custom GrapesJS component of type `template-ref` is inserted instead:

```jsonc
{
  "type": "template-ref",
  "attributes": { "data-slug": "header" }
}
```

This node carries no content of its own. At render time the server looks up the template by `(tenantId, slug)` and inlines its `data` subtree where the ref was. Edits to `Template.data` propagate to every Page containing a matching `template-ref` on next render — no Page rewrite needed.

In the editor canvas, `template-ref` renders as a **locked, read-only preview** of the resolved template content. Clicking it does not enter edit-in-place mode — instead it offers an "Edit template" action that navigates to a dedicated editor route. See [Editing](#editing).

## Sync toggle semantics

The `synced` flag affects **future inserts only**. Existing copies and existing refs are not retroactively rewritten when the flag changes.

### Unsynced → Synced

Future drops of this template insert `template-ref` nodes. Existing copies in Pages stay as plain components — they are not relinked. (Doing the retroactive link would require walking every `Page.data` JSON and pattern-matching subtrees against the template's content, which is brittle and surprising.)

### Synced → Unsynced

Future drops of this template insert copies. Existing `template-ref` nodes in Pages stay as refs — they continue resolving to the latest `Template.data` at render. To break a specific page's link, the user invokes a per-instance **Detach** action that replaces *that* `template-ref` with the resolved tree inlined as plain components.

This mirrors WordPress's behavior and avoids any "surprise rewrite" of Page rows when an admin toggles a template's sync state.

## Convert-to-template

Any selection in the editor — a built-in block, a section the user just built by hand, an existing `template-ref` instance — can be promoted to a Template:

1. User selects a subtree, picks **Create template**.
2. Modal collects `title`, `kind` (LAYOUT / PATTERN / PART + `area` if PART), and the `synced` toggle.
3. Backend creates a `Template` row with `data = serializedSubtree`.
4. If `synced = true`: **the user's original selection is replaced** with a `template-ref` to the new template. The source page now contains an instance of the new template, not the inlined tree.
5. If `synced = false`: leave the original selection as-is. The template now exists in the library for future drops, but this page is not linked to it.

This is the WordPress "Create pattern from selection" flow.

## Global library

`Template.tenantId` is nullable. A row with `tenantId = NULL` is a **global** template, visible to every tenant.

### Resolution rule

When a Page belonging to tenant `T` renders a `template-ref` with slug `header`:

```sql
SELECT * FROM templates
WHERE slug = 'header' AND (tenant_id = $T OR tenant_id IS NULL)
ORDER BY tenant_id NULLS LAST
LIMIT 1;
```

The tenant-scoped row wins if present; otherwise the global row wins. This gives **WP-style shadowing for free**: a tenant overrides a global by creating a template with the same slug, the same way a `wp_template_part` DB row shadows a theme's `/parts/header.html` file in WordPress.

### Permissions

Writes against `tenantId IS NULL` are restricted to app admins. Tenant users can only create rows where `tenantId = <their tenant>`. Enforced at the action layer (`lib/cms/template-actions.ts` when built); the DB column allows null but business logic gates it.

### Built-in vs DB globals

Two separate layers of "global," kept distinct:

- **Code-defined block primitives** — GrapesJS component types and Block palette items in `lib/plugins/patterns/`, `lib/plugins/columns/`. These ship with the app, deploy with code. They are not `Template` rows; they are GrapesJS Blocks whose `content` GrapesJS itself inlines on drop. Use these for primitive building blocks (cards, columns, generic hero shells).
- **DB-defined globals** — `Template` rows with `tenantId = NULL`. Admin-authored content (a finished "Landing layout," a curated "Default header" PART). No deploy needed to update.

Both surfaces show in the same inserter UI; only the data backend differs. This matches WP's split between PHP-registered patterns from the theme and DB-stored patterns from the user.

## Special template slugs

Certain slugs on `kind = LAYOUT` templates are reserved as conventional names for render states, analogous to WP's template hierarchy and Next.js's special-file routing. The renderer maps them to specific request scenarios:

| Slug | Used for |
|---|---|
| `home` | Site root, when no Page with `path = "/"` exists |
| `singular` | Default for any single Page/Post that doesn't match a more specific template |
| `archive` | Listing pages (e.g., `/blog`) |
| `404` | Not-found responses |
| `error` | Server-error responses |

When the renderer needs a layout for a given request state, it looks up `(tenant, slug)` first, then falls back to global, then falls back to a hardcoded default. Tenants can override any of these by creating a same-slug template.

This list is intentionally short. Add new reserved slugs sparingly — each one is a contract between the renderer and the data layer.

## The `template-ref` component type

Not yet implemented. Sketch only.

```ts
editor.Components.addType("template-ref", {
  isComponent: (el) => el?.tagName === "TEMPLATE-REF",
  model: {
    defaults: {
      // Locked, non-editable, but selectable to surface the toolbar.
      draggable: true,
      droppable: false,
      editable: false,
      selectable: true,
      hoverable: true,
      locked: true,
      // Custom toolbar action: "Edit template" → navigate to fragment route.
      toolbar: [{ command: "tc:edit-template", label: "Edit" }],
      // The slug to resolve.
      attributes: { "data-slug": "" },
    },
    init() {
      // On model creation, fetch the resolved template tree from the
      // server-side resolution endpoint and append it as locked
      // children for canvas display. Re-fetch on `tenant:templates:change`
      // (broadcast when the user saves a template in another tab).
    },
  },
  view: {
    onRender({ el }) {
      // Render a "badge" overlay so users can tell this is a referenced
      // template, not a hand-built section.
    },
  },
});
```

Two operational concerns:

- **Canvas resolution.** The editor needs a way to render the resolved tree on canvas without making it editable. Either fetch+inline-as-locked-children on `init`, or render an iframe slot that pulls the template's HTML/CSS at preview-render quality. Inline-as-locked is simpler and matches how GrapesJS Symbols work today.
- **Cache invalidation across tabs.** If the user opens a template in tab B, saves it, then returns to tab A with the Page, tab A's canvas still shows the stale subtree. A simple cross-tab broadcast (`BroadcastChannel`) on save plus `init`-style re-fetch on activation should be enough; revisit if it isn't.

## Server-side resolution at render

The preview render path (and eventually the published render path) walks the Page's component tree and replaces every `template-ref` with its resolved content.

```ts
async function resolvePageTree(
  tenantId: string,
  tree: ComponentDefinition,
): Promise<ComponentDefinition> {
  if (tree.type === "template-ref") {
    const slug = tree.attributes?.["data-slug"];
    const tpl = await loadTemplate(tenantId, slug); // tenant > global
    if (!tpl) return placeholder(slug);
    return resolvePageTree(tenantId, tpl.data); // recurse: templates can contain refs
  }
  return {
    ...tree,
    components: await Promise.all(
      (tree.components ?? []).map((c) => resolvePageTree(tenantId, c)),
    ),
  };
}
```

Three things to note:

- **Recursive resolution.** A `LAYOUT` can contain `template-ref` to PARTs, which can contain refs to other PATTERNs. Walk the tree fully; don't stop at the first inline.
- **Cycle guard.** A template referencing itself (or a cycle through several templates) would loop forever. Track visited slugs in a Set and bail with a placeholder when one repeats.
- **Per-request cache.** Within one render, multiple refs to the same slug should hit one DB read. Memoize by `(tenantId, slug)` for the duration of the request.

Caching beyond one request (e.g., `unstable_cache` with tag invalidation) follows the same pattern the theme system already uses — bump a per-template version on save, embed it in the resolver's cache key. Out of scope for the initial migration; revisit when the resolver lands.

## Editing

Templates are edited on their own route: `/admin/templates/[id]/edit` (path subject to UX). The editor opens the template as a standalone GrapesJS project — same shell, same storage adapter, just sourced from `Template.data` instead of `Page.data`.

A `template-ref` on a Page canvas is locked and read-only. Clicking it offers an "Edit template" toolbar action that navigates to that route. This matches WordPress's Site Editor behavior (clicking a template part navigates into the part editor) and avoids any "am I editing the Page or the template" confusion.

Saving in the template editor:

1. Validates the GrapesJS project shape against the same content rules used for Pages.
2. Writes `Template.data` and bumps `updatedAt` (and a future `version` integer — see [Open questions](#open-questions)).
3. Broadcasts a cross-tab event so any open Page editor with a matching `template-ref` can refresh its canvas preview.

## Open questions

These can wait until after the initial migration ships.

- **Versioning.** Should `Template` carry a monotonic `version: Int` à la `Tenant.themeVersion`? Lets render-path caching key on `(tenantId, slug, version)` and serve immutable resolved trees. Useful once cache layers go in.
- **Variations.** WordPress supports template variations (e.g., "default" vs "wide" landing layouts). Same template document, different style application. Possibly modeled as a `parentId` self-relation on `Template` with an inherited+overridden `data` chain. Defer until users ask for it.
- **Cross-tenant sharing beyond globals.** A "marketplace" pattern (one tenant publishes a template, others can install). Out of scope; mention only because the schema doesn't currently support it cleanly (would need a many-to-many or copy-on-install).
- **Template-level theme overrides.** Should a template be able to ship its own theme tokens? Probably not — themes are tenant-level and templates inherit. Re-evaluate if a real use case appears.

## Related

- `docs/reference/theme-document.md` — the tenant-level theme system that templates inherit.
- `docs/reference/preview-theme-css-flow.md` — how the preview render path consumes tenant theme CSS.
- `docs/reference/css-publish-architecture.md` — how protected CssRules stay out of per-page blobs (the same `protected: true` discipline matters for templates).
