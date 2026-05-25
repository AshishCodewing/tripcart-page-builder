import { cookies, draftMode } from "next/headers"
import { redirect } from "next/navigation"

import { PREVIEW_TENANT_COOKIE } from "@/lib/cms/tenants"

export async function GET() {
  const draft = await draftMode()
  draft.disable()

  const cookieStore = await cookies()
  cookieStore.delete(PREVIEW_TENANT_COOKIE)

  redirect("/admin")
}
