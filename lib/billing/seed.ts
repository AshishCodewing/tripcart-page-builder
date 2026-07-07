/**
 * One-time signup credit grant. Idempotent by ledger key (`seed:{tenantId}`),
 * so it's safe to call from tenant creation, the backfill script, and the
 * gate's self-heal path — the grant can only ever post once per tenant.
 */
import {
  ACCOUNT_CODES,
  accounts,
  DuplicateTransactionError,
  ledger,
  LedgerFactory,
} from "@/lib/ledger"

export const SEED_CREDITS = 200_000n

export async function seedTenantCredits(tenantId: string): Promise<void> {
  await accounts.ensureSystemAccounts()
  const [issuanceAccountId, wallet] = await Promise.all([
    accounts.getSystemAccountId(ACCOUNT_CODES.CREDIT_ISSUANCE),
    accounts.ensureTenantWallet(tenantId),
  ])

  try {
    await ledger.postTransaction(
      LedgerFactory.createSubscriptionGrant({
        tenantId,
        issuanceAccountId,
        walletAccountId: wallet.id,
        credits: SEED_CREDITS,
        billingCycleId: `seed:${tenantId}`,
        idempotencyKey: `seed:${tenantId}`,
        description: "One-time signup credit grant",
      })
    )
  } catch (e) {
    // A racing twin already posted the grant — that's the outcome we wanted.
    if (!(e instanceof DuplicateTransactionError)) throw e
  }
}
