# CSS Architecture: Internal vs External at Publish Time

## Current system (as of 2026-05-12)

| Context | Approach | Status |
|---|---|---|
| Editor canvas iframe | External (`CANVAS_STYLE_URLS`) | Correct — vendor CSS cached by browser |
| Admin preview (`page-preview.tsx`) | Internal `<style>` | Fine — one-off render, no caching benefit needed |
| Published output (`RenderProject`) | Internal `<style>` | Works for POC; switch to external at publish time |

## How Webflow does it

- **Canvas (authoring):** External CSS files in the iframe — same as our `CANVAS_STYLE_URLS` pattern.
- **Published output:** Single external `site.webflow.css`, content-hashed, CDN-cached, linked via `<link rel="stylesheet">`.
- **Why it works:** Webflow uses a global class model — `.hero-title` defined once is shared across all pages. One cache hit covers the entire site's styles for return visitors.

## How Plasmic does it

- **Codegen mode:** Generates `.module.css` files; Next.js extracts them to external chunks at build time.
- **Loader API mode:** CSS extracted per-component; the framework decides inline vs external.
- **Hosted pages:** Inlines CSS as `<style>` for fastest FCP when there's no pre-existing cache relationship with the visitor.
- Plasmic optimizes for **component-level isolation**; Webflow optimizes for **global class reuse**.

## When internal CSS is better

- Single-page sites (no cross-page sharing benefit)
- Pages with 100% unique per-page CSS (no class reuse across pages)
- Guaranteed FCP with no render-blocking latency risk
- Server-side previews inside the Next.js app (keep the current admin preview path as-is)

## What to do at publish time

At publish, extract `editor.getCss()` and write it as a separate file instead of embedding it inline.

```ts
// publish action (pseudocode)
const css = editor.getCss()
const hash = contentHash(css)                          // e.g., sha256 first 8 chars
const cssUrl = await blob.put(
  `pages/${pageId}/${hash}.css`,
  css,
  { contentType: "text/css", cacheControl: "public, max-age=31536000, immutable" }
)

// Store cssUrl on the Page row alongside projectData
await db.page.update({ where: { id: pageId }, data: { cssUrl } })
```

Then in the published HTML template:

```html
<!-- instead of <style>...inline css...</style> -->
<link rel="stylesheet" href="<cssUrl>" />
```

### Why content hashing matters

GrapesJS class names are **stable across re-edits** — a color change re-publishes the same class names with new values. The hash changes, the old file stays cached for concurrent visitors, new requests get the new file. No coordinated cache invalidation needed.

### What stays internal (inline `<style>`)

- Admin preview in the Next.js app (`page-preview.tsx`) — keep as-is, no cache benefit
- `RenderProject` for component-level previews — keep as-is
- Any CSS that is truly per-render (dynamic, user-specific, or theme-overrides applied at request time)

## Vendor CSS in the canvas

The `CANVAS_STYLE_URLS` pattern (`/vendor/open-props-*.min.css`) is already correct:
- Loaded externally into the GrapesJS iframe
- Browser caches them across editor sessions
- **Not included in `editor.getHtml()` output** — must be linked separately in the published template too

```html
<!-- published template must also include these -->
<link rel="stylesheet" href="/vendor/open-props-sizes.min.css" />
<link rel="stylesheet" href="/vendor/open-props-fonts.min.css" />
<link rel="stylesheet" href="/vendor/open-props-borders.min.css" />
<link rel="stylesheet" href="/vendor/open-props-colors-hsl.min.css" />
<!-- then the page-specific CSS -->
<link rel="stylesheet" href="<cssUrl>" />
```

## Files to touch when implementing

- `components/page-builder/editor-shell.tsx` — publish action (currently `editor.getProjectData()` at line ~339); add CSS extraction + blob upload here
- `components/page-builder/page-preview.tsx` — keep internal `<style>` (admin only)
- `lib/plugins/react-renderer/project/render-project.tsx` — keep internal `<style>` for preview mode; published pages bypass this renderer entirely
- Prisma schema — add `cssUrl String?` to the `Page` (and `Post`) model
- Published HTML template (wherever it lives) — swap `<style>` for `<link>`
