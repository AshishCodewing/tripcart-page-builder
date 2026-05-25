import { cookies, draftMode } from "next/headers"
import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"

import { PREVIEW_TENANT_COOKIE } from "@/lib/cms/tenants"
import { prisma } from "@/lib/prisma"

// Enable draft mode, pin the preview session to a tenant, and redirect
// to the requested preview path.
//
// The tenant cookie is what makes the preview routes return the right
// page when multiple tenants share a path (e.g. both have `/about`).
// HttpOnly + sameSite=lax: the cookie is server-only and travels with
// in-preview navigation.
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

  // Validate before pinning. A stale tenantId in the URL shouldn't
  // produce a cookie that 404s every subsequent navigation.
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  })
  if (!tenant) {
    return new Response("Tenant not found.", { status: 404 })
  }

  const draft = await draftMode()
  draft.enable()

  const cookieStore = await cookies()
  cookieStore.set(PREVIEW_TENANT_COOKIE, tenant.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  })

  redirect(path)
}
