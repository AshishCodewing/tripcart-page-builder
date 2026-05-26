import { getTenantTheme } from "@/lib/cms/tenants"
import { compiledThemeToCss, compileTheme } from "@/lib/theme/compile"

// Serves the compiled tenant theme as a stylesheet so the preview
// layout can enqueue it via `<link rel="stylesheet">` instead of
// inlining a `<style>` block on every preview render.
//
// The `[version]` URL segment is a cache key, not a content selector —
// this handler always serves the *current* theme. The contract is:
//
//   1. `updateTenantTheme` bumps `Tenant.themeVersion`.
//   2. The next preview render reads the new version and emits a new
//      stylesheet URL.
//   3. Browser/CDN cache miss, fetches origin, gets the new theme.
//   4. The old URL's cached response stays cached forever (`immutable`),
//      but nothing requests it anymore.
//
// This works because preview HTML is always server-rendered fresh
// (draft mode → dynamic), so the URL the browser sees is always the
// current version. No purges or tag invalidation needed.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string; version: string }> }
): Promise<Response> {
  const { tenantId } = await params

  let css: string
  try {
    const theme = await getTenantTheme(tenantId)
    css = compiledThemeToCss(compileTheme(theme))
  } catch {
    return new Response("/* tenant not found */", {
      status: 404,
      headers: { "content-type": "text/css; charset=utf-8" },
    })
  }

  return new Response(css, {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
    },
  })
}
