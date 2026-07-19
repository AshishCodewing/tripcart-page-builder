/**
 * "Glance before pour" (Option A, docs/reference/ai-usage-billing-gap.md):
 * a cheap balance pre-check before starting AI work. The actual charge posts
 * after the run from real token counts; the small window where concurrent
 * requests overshoot the balance is accepted and handled by clamping.
 */
import { eq } from "drizzle-orm"

import { AccountNotFoundError, balances } from "@/lib/ledger"
import { db } from "@/lib/db"
import { tenants } from "@/lib/schema"
import { seedTenantCredits } from "./seed"

/** JSON body both AI routes return with HTTP 402. */
export const INSUFFICIENT_CREDITS = {
  error: "Your workspace is out of AI credits.",
  code: "INSUFFICIENT_CREDITS",
} as const

export async function hasCredits(tenantId: string): Promise<boolean> {
  try {
    return (await balances.getWalletBalance(tenantId)) > 0n
  } catch (e) {
    if (e instanceof AccountNotFoundError) {
      // No wallet yet — a tenant created before billing shipped (or whose
      // creation-time seed failed). Seed it now, but only for real tenants:
      // the ledger happily creates accounts for arbitrary strings.
      try {
        const tenant = await db.query.tenants.findFirst({
          where: eq(tenants.id, tenantId),
          columns: { id: true },
        })
        if (!tenant) return false
        await seedTenantCredits(tenantId)
        return (await balances.getWalletBalance(tenantId)) > 0n
      } catch (seedError) {
        console.error(
          `[billing] wallet self-heal failed for tenant ${tenantId}:`,
          seedError
        )
        return true // fail open — availability over enforcement
      }
    }
    console.error(`[billing] balance check failed for tenant ${tenantId}:`, e)
    return true // fail open
  }
}
