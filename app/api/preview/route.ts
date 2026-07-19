import { draftMode } from "next/headers"
import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"

import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { tenants } from "@/lib/schema"

// Enable draft mode and redirect into the tenant-scoped preview tree.
//
// Tenant is encoded in the redirect target (`/preview/<tenantId>...`)
// rather than a cookie — the preview routes read it from params, which
// keeps the URL self-describing and lets multiple tenants be previewed
// concurrently in different tabs of the same browser.
//
// TODO: gate this route behind real auth before exposing beyond local
// dev. Today, anyone who knows this URL can enable draft mode for any
// tenant. Once admin auth is in place, require an authenticated session
// here and verify the user has access to `tenantId`.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get("path")
  const tenantId = searchParams.get("tenantId")

  if (!path || !path.startsWith("/")) {
    return new Response("Missing or invalid `path` query parameter.", {
      status: 400,
    })
  }
  if (!tenantId) {
    return new Response("Missing `tenantId` query parameter.", {
      status: 400,
    })
  }

  // Validate before redirecting. A stale tenantId in the URL shouldn't
  // produce a permanent 404 link the user has to escape from manually.
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { id: true },
  })
  if (!tenant) {
    return new Response("Tenant not found.", { status: 404 })
  }

  const draft = await draftMode()
  draft.enable()

  redirect(`/preview/${tenant.id}${path}`)
}
