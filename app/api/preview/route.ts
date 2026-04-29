import { draftMode } from "next/headers"
import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"

// Enable draft mode and redirect to the requested preview path.
//
// TODO: gate this route behind real auth before exposing beyond local dev.
// Today, anyone who knows this URL can enable draft mode for themselves.
// Once admin auth is in place, require an authenticated session here.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get("path")

  if (!path || !path.startsWith("/")) {
    return new Response("Missing or invalid `path` query parameter.", {
      status: 400,
    })
  }

  const draft = await draftMode()
  draft.enable()

  redirect(path)
}
