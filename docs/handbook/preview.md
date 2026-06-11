# Preview & Publishing

How saved content gets rendered for humans — the path from stored JSON to actual HTML.

## Preview vs. public

This app contains the **editor + preview**. Public rendering of published pages
happens in a **separate deployment** that consumes the same database. The
`app/preview/` routes here are gated behind Next.js **draft mode** and 404 when it's
off — they exist for authors to see their work, not for visitors.

## Entering preview

The editor's preview button links to **`/api/preview?tenantId=…&path=…`**. That route
validates the tenant, enables draft mode, and redirects into
**`/preview/[tenantId]/...`**. Tenant lives in the URL (not a cookie) so multiple
tenants can be previewed in different tabs at once. `/api/preview/exit` disables draft
mode.

## The render path

```
/preview/[tenantId]/[...slug]   (RSC, draft-mode-gated)
   │ look up page by (tenantId, path)
   ▼
resolvePageTree(tenantId, page.data)      ← inline template-refs, merge their styles
   ▼
<PagePreview projectData config={{ components: patternComponents }} />
   ▼
React Renderer (project module)           ← JSON → React tree, page CSS inlined
```

The same path serves posts (`/preview/[tenantId]/blog/[slug]`, keyed by
`(tenantId, slug)`).

Two things make the output correct:

1. **Template refs are resolved** server-side (`resolvePageTree`) so synced templates
   render their current content. See [templates.md](templates.md).
2. **The same `patternComponents` registry** the editor uses is passed to the
   renderer, so React-backed blocks render identically here. See
   [react-renderer.md](react-renderer.md).

## Theme injection

The preview **layout** (`app/preview/[tenantId]/layout.tsx`) — not the page —
injects the tenant's brand theme by linking the compiled, versioned stylesheet
`/api/preview/theme/[tenantId]/[version]/theme.css`. It runs once for the whole
preview subtree; each page only adds its own page-scoped CSS on top. See
[theming.md](theming.md).

## A defensive detail

`PagePreview` filters protected (theme) rules out of `page.data` again before
rendering. New publishes already strip them, but pages published before that landed
may carry a stale theme snapshot — filtering keeps the layout's fresh theme winning
the cascade.

For the exact route files, draft-mode handling, and the `PagePreview` ↔ project
renderer seam, see [preview.technical.md](preview.technical.md).
