/**
 * "Glance before pour" (Option A, docs/reference/ai-usage-billing-gap.md):
 * a cheap balance pre-check before starting AI work. The actual charge posts
 * after the run from real token counts; the small window where concurrent
 * requests overshoot the balance is accepted and handled by clamping.
 */
import { AccountNotFoundError, balances } from "@/lib/ledger"
import { prisma } from "@/lib/prisma"
import { seedTenantCredits } from "./seed"

/** JSON body both AI routes return with HTTP 402. */
export const INSUFFICIENT_CREDITS = {
  error: "Your workspace is out of AI credits.",
  code: "INSUFFICIENT_CREDITS",
} as const

/**
 * Policy for balance-check failures. Default is fail OPEN (availability over
 * enforcement — a DB blip must not brick the copilot for paying tenants); set
 * BILLING_GATE_FAIL_CLOSED=1 to prefer cost safety instead. Either way the
 * write path still clamps to the real balance (ai-usage.service.ts), so
 * fail-open bounds the loss to one run's overage.
 */
function failOpen(): boolean {
  return process.env.BILLING_GATE_FAIL_CLOSED !== "1"
}

export async function hasCredits(tenantId: string): Promise<boolean> {
  try {
    return (await balances.getWalletBalance(tenantId)) > 0n
  } catch (e) {
    if (e instanceof AccountNotFoundError) {
      // No wallet yet — a tenant created before billing shipped (or whose
      // creation-time seed failed). Seed it now, but only for real tenants:
      // the ledger happily creates accounts for arbitrary strings.
      try {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true },
        })
        if (!tenant) return false
        await seedTenantCredits(tenantId)
        return (await balances.getWalletBalance(tenantId)) > 0n
      } catch (seedError) {
        console.error(
          `[billing] wallet self-heal failed for tenant ${tenantId}:`,
          seedError
        )
        return failOpen() // availability over enforcement (unless flagged)
      }
    }
    console.error(`[billing] balance check failed for tenant ${tenantId}:`, e)
    return failOpen()
  }
}
