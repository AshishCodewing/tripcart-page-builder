# Preview & Publishing — technical

Read [preview.md](preview.md) first.

## Routes

| Route | Responsibility |
|---|---|
| `app/api/preview/route.ts` | GET `?tenantId&path` → validate tenant, `draftMode().enable()`, `redirect(/preview/<id><path>)`. (TODO: gate behind auth — currently anyone with the URL can enable draft mode.) |
| `app/api/preview/exit/route.ts` | `draftMode().disable()` → redirect `/admin`. |
| `app/preview/[tenantId]/layout.tsx` | Links the versioned theme stylesheet for the whole subtree (`precedence="default"`). No draft check (pages 404 themselves). |
| `app/preview/[tenantId]/[...slug]/page.tsx` | Page render: `draftMode()` gate → `prisma.page.findUnique({ tenantId_path })` → `resolvePageTree` → `<PagePreview config={{components: patternComponents}} />`. |
| `app/preview/[tenantId]/blog/[slug]/page.tsx` | Same for posts, keyed by `tenantId_slug`; wraps in an `<article>` with title/date. |
| `app/preview/[tenantId]/blog/page.tsx` | Simple draft-mode blog index. |
| `app/api/preview/theme/[tenantId]/[version]/theme.css/route.ts` | Compiled theme CSS, `immutable`. See [theming.technical.md](theming.technical.md). |

Every content page calls `await draftMode()` and `notFound()` when disabled.

## PagePreview — `components/page-builder/page-preview.tsx`

The seam between the resolved JSON and the server renderer:

- `filterProtectedStyles(projectData)` (defensive — legacy blobs).
- `new ProjectEditor(filtered)` → `editor.Css.getCssAsString()` for the page CSS.
- Takes the wrapper's children and renders each with
  `RenderComponent({ component, config, parentId, index })` — **not** `RenderPage`,
  because the host Next.js layout already supplies `<html>/<body>`. The wrapper's
  classes go on a transparent host `<div data-page-preview-root>`.
- Page CSS is injected as a `<style>` block; the tenant theme comes from the layout's
  linked stylesheet.

`config.components` = `patternComponents`, so React-backed blocks resolve to their
real components (see [react-renderer.technical.md](react-renderer.technical.md)).

## Resolution before render

`resolvePageTree(tenantId, page.data)` (`lib/cms/templates.ts`) returns a new
`ProjectDefinition` with all `template-ref` nodes inlined and template styles merged.
Always called before `PagePreview`. See [templates.technical.md](templates.technical.md).

## Notes / gotchas

- Tenant is carried in the **URL**, not a cookie — concurrent multi-tenant previews
  work, and the lookup keys are tenant-scoped compound keys.
- The layout renders above 404s; emitting the theme `<link>` on a 404 is harmless. A
  stale tenant id skips the link rather than erroring.
- Public production rendering is a separate deployment over the same DB; these routes
  are preview-only by design.
