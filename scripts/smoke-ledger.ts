/**
 * End-to-end smoke test for the credit ledger against the LOCAL database.
 * Exercises the real postTransaction path (locks, idempotency, negative guard,
 * projection) — the behavior the pure unit tests can't reach.
 *
 *   pnpm smoke:ledger
 *
 * Uses a unique throwaway tenant per run and cleans up everything it creates
 * (including rebuilding the system-account projections it touched), so it's
 * safe to run repeatedly and leaves no residue.
 */
import "dotenv/config"

import { eq, inArray } from "drizzle-orm"

import {
  ACCOUNT_CODES,
  createLedger,
  InsufficientCreditsError,
  LedgerFactory,
} from "@/lib/ledger"
import { db, pool } from "@/lib/db"
import {
  accountBalances,
  ledgerAccounts,
  ledgerEntries,
  ledgerTransactions,
} from "@/lib/schema"

async function main() {
  const { ledger, accounts, balances } = createLedger()

  const runId = Date.now().toString()
  const tenantId = `smoke-${runId}`
  const createdTxIds: string[] = []
  let walletId: string | undefined
  let issuanceId: string | undefined
  let aiConsumedId: string | undefined

  function check(cond: boolean, label: string) {
    if (!cond) throw new Error(`FAIL: ${label}`)
    console.log(`  ✓ ${label}`)
  }

  try {
    // --- system accounts --------------------------------------------------
    await accounts.ensureSystemAccounts()
    issuanceId = await accounts.getSystemAccountId(
      ACCOUNT_CODES.CREDIT_ISSUANCE
    )
    aiConsumedId = await accounts.getSystemAccountId(ACCOUNT_CODES.AI_CONSUMED)
    console.log("system accounts ensured")

    // --- tenant wallet ----------------------------------------------------
    const wallet = await accounts.ensureTenantWallet(tenantId)
    walletId = wallet.id
    check(
      (await balances.getWalletBalance(tenantId)) === 0n,
      "new wallet starts at 0"
    )

    // --- grant 100 credits ------------------------------------------------
    const grant = LedgerFactory.createSubscriptionGrant({
      tenantId,
      issuanceAccountId: issuanceId,
      walletAccountId: walletId,
      credits: 100n,
      billingCycleId: `cycle-${runId}`,
      idempotencyKey: `grant-${runId}`,
    })
    const grantPosted = await ledger.postTransaction(grant)
    createdTxIds.push(grantPosted.id)
    check(
      (await balances.getWalletBalance(tenantId)) === 100_000n,
      "grant of 100 credits -> 100000 units"
    )

    // --- spend 25 credits -------------------------------------------------
    const usagePosted = await ledger.postTransaction(
      LedgerFactory.createAIUsage({
        tenantId,
        walletAccountId: walletId,
        aiConsumedAccountId: aiConsumedId,
        credits: 25n,
        usageId: `usage-${runId}`,
        idempotencyKey: `usage-${runId}`,
      })
    )
    createdTxIds.push(usagePosted.id)
    check(
      (await balances.getWalletBalance(tenantId)) === 75_000n,
      "spend of 25 credits -> 75000 units"
    )

    // --- idempotent replay (same key) ------------------------------------
    const replay = await ledger.postTransaction(grant)
    check(
      replay.id === grantPosted.id,
      "replay returns the original transaction id"
    )
    check(
      (await balances.getWalletBalance(tenantId)) === 75_000n,
      "replay does not change the balance"
    )

    // --- negative guard ---------------------------------------------------
    let blocked = false
    try {
      await ledger.postTransaction(
        LedgerFactory.createAIUsage({
          tenantId,
          walletAccountId: walletId,
          aiConsumedAccountId: aiConsumedId,
          credits: 1000n, // 1_000_000 units, far over the 75_000 balance
          usageId: `over-${runId}`,
          idempotencyKey: `over-${runId}`,
        })
      )
    } catch (e) {
      blocked = e instanceof InsufficientCreditsError
    }
    check(blocked, "overspend throws InsufficientCreditsError")
    check(
      (await balances.getWalletBalance(tenantId)) === 75_000n,
      "blocked overspend leaves the balance unchanged"
    )

    // --- integrity --------------------------------------------------------
    check(await balances.verify(walletId), "projection equals SUM(entries)")

    console.log("\n✅ all smoke checks passed")
  } finally {
    await cleanup({
      balances,
      createdTxIds,
      walletId,
      issuanceId,
      aiConsumedId,
    })
  }
}

async function cleanup(ctx: {
  balances: ReturnType<typeof createLedger>["balances"]
  createdTxIds: string[]
  walletId?: string
  issuanceId?: string
  aiConsumedId?: string
}) {
  try {
    if (ctx.createdTxIds.length > 0) {
      // entries first (FK is RESTRICT), then the transactions.
      await db
        .delete(ledgerEntries)
        .where(inArray(ledgerEntries.transactionId, ctx.createdTxIds))
      await db
        .delete(ledgerTransactions)
        .where(inArray(ledgerTransactions.id, ctx.createdTxIds))
    }
    if (ctx.walletId) {
      await db
        .delete(accountBalances)
        .where(eq(accountBalances.accountId, ctx.walletId))
      await db.delete(ledgerAccounts).where(eq(ledgerAccounts.id, ctx.walletId))
    }
    // We removed entries that touched the shared system accounts, so their
    // projections drifted — recompute from the surviving entries.
    if (ctx.issuanceId) await ctx.balances.rebuild(ctx.issuanceId)
    if (ctx.aiConsumedId) await ctx.balances.rebuild(ctx.aiConsumedId)
    console.log("🧹 cleaned up smoke data")
  } catch (e) {
    console.error("cleanup error (non-fatal):", e)
  }
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(`\n❌ ${e instanceof Error ? e.message : e}`)
    await pool.end()
    process.exit(1)
  })
