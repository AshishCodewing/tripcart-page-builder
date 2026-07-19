import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { pages, posts, templates } from "@/lib/schema"

// Serves a stored CSS artifact (see lib/cms/css-artifacts.ts + plan 023) as
// an immutable stylesheet: `/api/css/{kind}/{id}/{cssHash}/styles.css` with
// kind ∈ page | post | template. The tenant theme keeps its own route
// (`/api/preview/theme/...`); its baked `themeCss` column is for a future
// read-only renderer, not this handler.
//
// The `[hash]` URL segment is a cache key, not a content selector — this
// handler always serves the row's *current* artifact. The contract mirrors
// the theme route:
//
//   1. Every `data` write re-bakes `css` + `cssHash` (buildDraftDataUpdate).
//   2. A renderer embedding the stylesheet reads `cssHash` from the row and
//      emits the versioned URL, so the URL it links rotates on every edit.
//   3. Browser/CDN cache miss on the new URL, fetch hits origin.
//   4. The old URL's cached response stays cached forever (`immutable`) but
//      nothing references it anymore.
//
// The artifact is UNRESOLVED — a page's CSS contains only its own rules.
// A consumer resolves template-refs first, then composes page CSS plus each
// part's CSS, treating a missing part artifact as empty.
//
// `css = null` (row predates the pipeline) is a strict 404 — the fix is
// `pnpm backfill:css`, not lazy compilation in a public read path.

const notFound = (reason: string) =>
  new Response(`/* ${reason} */`, {
    status: 404,
    headers: { "content-type": "text/css; charset=utf-8" },
  })

async function loadArtifact(kind: string, id: string): Promise<string | null> {
  const columns = { css: true } as const
  switch (kind) {
    case "page":
      return (
        (await db.query.pages.findFirst({ where: eq(pages.id, id), columns }))
          ?.css ?? null
      )
    case "post":
      return (
        (await db.query.posts.findFirst({ where: eq(posts.id, id), columns }))
          ?.css ?? null
      )
    case "template":
      return (
        (
          await db.query.templates.findFirst({
            where: eq(templates.id, id),
            columns,
          })
        )?.css ?? null
      )
    default:
      return null
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; id: string; hash: string }> }
): Promise<Response> {
  const { kind, id } = await params

  const css = await loadArtifact(kind, id)
  if (css === null) return notFound("no css artifact")

  return new Response(css, {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
    },
  })
}
