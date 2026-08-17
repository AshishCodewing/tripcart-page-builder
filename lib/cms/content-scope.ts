import { eq } from "drizzle-orm"

import type { ThreadKind } from "@/lib/ai/thread-id"
import { db } from "@/lib/db"
import { pages, posts, templates } from "@/lib/schema"

/**
 * The owning tenant of an editable entity, read from the CMS tables.
 *
 * The copilot's persistence layer must never take a tenant from the request:
 * that value is client-supplied (see the TODO(auth) in app/api/chat/route.ts),
 * so trusting it would let a caller file — or read — transcripts under someone
 * else's tenant. Every write resolves ownership through here instead.
 *
 * `null` is a real answer, not an absence: global templates have no tenant.
 * A missing entity is `undefined`, and that distinction is what stops a
 * transcript being filed against an invented content id.
 */
export async function tryResolveContentTenantId(
  kind: ThreadKind,
  contentId: string
): Promise<string | null | undefined> {
  switch (kind) {
    case "page": {
      const row = await db.query.pages.findFirst({
        where: eq(pages.id, contentId),
        columns: { tenantId: true },
      })
      return row?.tenantId
    }
    case "post": {
      const row = await db.query.posts.findFirst({
        where: eq(posts.id, contentId),
        columns: { tenantId: true },
      })
      return row?.tenantId
    }
    case "template": {
      const row = await db.query.templates.findFirst({
        where: eq(templates.id, contentId),
        columns: { tenantId: true },
      })
      return row?.tenantId
    }
  }
}

/** As {@link tryResolveContentTenantId}, but throws when the entity is gone. */
export async function resolveContentTenantId(
  kind: ThreadKind,
  contentId: string
): Promise<string | null> {
  const tenantId = await tryResolveContentTenantId(kind, contentId)
  if (tenantId === undefined) {
    throw new Error(`No ${kind} with id ${contentId}`)
  }
  return tenantId
}
