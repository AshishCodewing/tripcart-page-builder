# Preview Theme CSS: Request Flow

How a single preview page render flows through the theme-CSS path,
end-to-end. Covers the `/api/preview/theme/[tenantId]/[version]/theme.css`
route handler, the `<link>` in the preview layout, and the versioned-URL
cache contract.

## How a browser request flows end-to-end

1. User hits `/preview/abc123/about`.
2. Server renders `app/preview/[tenantId]/layout.tsx` — queries
   `Tenant.themeVersion` (say `4`) and emits HTML containing
   `<link rel="stylesheet" href="/api/preview/theme/abc123/4/theme.css"
   precedence="default">`.
3. React 19 hoists that `<link>` into `<head>` because of `precedence`.
4. Browser parses HTML, sees the `<link>`, blocks paint, fires a GET to
   `/api/preview/theme/abc123/4/theme.css`.
5. Browser checks its own cache for that exact URL first. Cache miss →
   request goes out.
6. Next.js routes the request to
   `app/api/preview/theme/[tenantId]/[version]/theme.css/route.ts` based
   on path matching. `tenantId = "abc123"`, `version = "4"`.
7. Handler fetches the tenant theme, compiles to CSS, returns `Response`
   with `text/css` and immutable cache headers.
8. Browser caches the response under that URL for a year and applies
   the CSS.
9. User navigates to another preview page. Same `<link>` URL → cache
   hit → no network request.
10. Someone edits the theme → `updateTenantTheme` increments
    `themeVersion` to `5` → next render emits `…/abc123/5/theme.css` →
    browser sees a URL it's never seen → cache miss → fetch → cache the
    new one. The `…/abc123/4/theme.css` entry sits in the cache unused
    until evicted.

## The naming "trick"

Three things to keep separate:

| Thing | Source of truth |
| --- | --- |
| Is this a CSS file? | The `content-type: text/css` response header |
| Where does the URL route to? | The folder structure under `app/` |
| What does the browser cache it as? | The exact URL string |

The `theme.css` segment is purely cosmetic — it makes the URL show up
nicely in DevTools' Network tab as a `.css` resource and in CDN logs as
an obvious stylesheet. You could rename the folder to `style` or
`bundle` and as long as you set `content-type: text/css`, it would work
identically. The `.css` in the URL is for humans, not browsers.

## Why this design

- **Per-tenant cache key.** The URL embeds `tenantId`, so each tenant
  has its own cache entry. Two tenants on the same browser don't share
  or stomp each other's CSS.
- **Versioned, immutable.** The URL embeds `themeVersion`, bumped
  atomically with the theme write in `updateTenantTheme`. The response
  is served `public, max-age=31536000, immutable`. New theme → new URL
  → guaranteed cache miss. No purges, no tag invalidation, no
  stale-while-revalidate dance.
- **HTML is always fresh.** Preview HTML is dynamic (draft-mode), so
  the `<link>` URL the browser sees always reflects the current
  `themeVersion`. Stale URLs are never re-requested. (If this pattern
  is ported to the public renderer with cached HTML, that assumption
  needs revisiting — see "Porting to public" below.)

## Contract: the handler ignores `version`

The `[version]` segment in the URL is a cache key, **not** a content
selector. The handler always returns the *current* theme. There is no
version history in the DB.

This is safe under the contract:

1. `updateTenantTheme` writes `theme` and `themeVersion` in the same
   transaction.
2. Any subsequent preview render reads the new `themeVersion` and emits
   the new URL.
3. The browser/CDN sees a new URL, fetches fresh, caches under that key.
4. Old URLs are never emitted by the server again. If something
   somehow requests an old URL, it just gets current theme — harmless,
   because there's nothing in the system that expects old-theme bytes
   under an old URL.

## Porting to public

The public renderer (separate deployment, consumes the same DB) can
reuse this exact handler shape. The wrinkle is HTML caching: if public
pages are cached/ISR'd, the HTML may reference an older `themeVersion`
URL than the current one. Two options:

- **Tag-invalidate HTML on theme bump.** `updateTenantTheme` already
  calls `updateTag(cacheTags.nav)`. Wire the public renderer's page
  fetches through `cacheTag(cacheTags.tenantTheme(tenantId))` so a
  theme edit busts both the theme CSS and the page HTML together.
- **Or shorter `max-age` on the CSS.** Drops `immutable`, sets e.g.
  `max-age=60`, accepts a brief window where cached HTML still
  references the just-stale CSS URL. CSS edits visibly converge within
  the window.

The current preview-only route uses `immutable` safely because preview
HTML is never cached.
