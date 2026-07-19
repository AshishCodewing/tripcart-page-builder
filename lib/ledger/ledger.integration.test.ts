/**
 * Postgres-backed integration tests for the credit ledger's single write entry
 * point, `LedgerService.postTransaction`. These pin the DB-level invariants the
 * pure unit tests (math/validator/factory) can't reach: idempotent replay,
 * FOR UPDATE serialization, the TENANT-only negative guard, atomic projection
 * update, and the P2002 → DuplicateTransactionError mapping.
 *
 * Runs only under `pnpm test:integration` (needs a real database); excluded
 * from the default `pnpm test`. Setup/teardown mirrors scripts/smoke-ledger.ts:
 * a unique throwaway tenant per test, and an afterEach that removes this test's
 * rows and rebuilds the shared system-account projections it touched, so the
 * suite is safe to run repeatedly and leaves no residue.
 */
import { eq, inArray, sum } from "drizzle-orm"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import {
  ACCOUNT_CODES,
  AccountNotFoundError,
  createLedger,
  DuplicateTransactionError,
  InsufficientCreditsError,
  type LedgerTransactionInput,
  LedgerFactory,
  UNITS_PER_CREDIT,
} from "@/lib/ledger"
import { db, pool } from "@/lib/db"
import {
  accountBalances,
  ledgerAccounts,
  ledgerEntries,
  ledgerTransactions,
} from "@/lib/schema"

const { ledger, accounts, balances } = createLedger()

let issuanceId: string
let aiConsumedId: string

// Rows this test created, torn down in afterEach.
let createdTxIds: string[] = []
let createdWalletIds: string[] = []

function uniqueTenantId(): string {
  return `itest-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** Fresh throwaway tenant + wallet; registers the wallet for cleanup. */
async function setupTenant(): Promise<{ tenantId: string; walletId: string }> {
  const tenantId = uniqueTenantId()
  const wallet = await accounts.ensureTenantWallet(tenantId)
  createdWalletIds.push(wallet.id)
  return { tenantId, walletId: wallet.id }
}

/** Post through the real service and remember the id for cleanup. */
async function post(input: LedgerTransactionInput) {
  const tx = await ledger.postTransaction(input)
  createdTxIds.push(tx.id)
  return tx
}

function grant(p: {
  tenantId: string
  walletId: string
  credits: bigint
  key: string
}): LedgerTransactionInput {
  return LedgerFactory.createSubscriptionGrant({
    tenantId: p.tenantId,
    issuanceAccountId: issuanceId,
    walletAccountId: p.walletId,
    credits: p.credits,
    billingCycleId: p.key,
    idempotencyKey: p.key,
  })
}

function usage(p: {
  tenantId: string
  walletId: string
  credits: bigint
  key: string
}): LedgerTransactionInput {
  return LedgerFactory.createAIUsage({
    tenantId: p.tenantId,
    walletAccountId: p.walletId,
    aiConsumedAccountId: aiConsumedId,
    credits: p.credits,
    usageId: p.key,
    idempotencyKey: p.key,
  })
}

/** Ground-truth balance straight from entries, bypassing the projection. */
async function sumEntries(accountId: string): Promise<bigint> {
  const [row] = await db
    .select({ total: sum(ledgerEntries.amount) })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.accountId, accountId))
  return row?.total ? BigInt(row.total) : 0n
}

beforeAll(async () => {
  await accounts.ensureSystemAccounts()
  issuanceId = await accounts.getSystemAccountId(ACCOUNT_CODES.CREDIT_ISSUANCE)
  aiConsumedId = await accounts.getSystemAccountId(ACCOUNT_CODES.AI_CONSUMED)
})

afterEach(async () => {
  if (createdTxIds.length > 0) {
    await db
      .delete(ledgerEntries)
      .where(inArray(ledgerEntries.transactionId, createdTxIds))
    await db
      .delete(ledgerTransactions)
      .where(inArray(ledgerTransactions.id, createdTxIds))
  }
  if (createdWalletIds.length > 0) {
    await db
      .delete(accountBalances)
      .where(inArray(accountBalances.accountId, createdWalletIds))
    await db
      .delete(ledgerAccounts)
      .where(inArray(ledgerAccounts.id, createdWalletIds))
  }
  // The deleted entries touched the shared system accounts — recompute their
  // projections from the surviving entries so the next test starts clean.
  await balances.rebuild(issuanceId)
  await balances.rebuild(aiConsumedId)
  createdTxIds = []
  createdWalletIds = []
})

// Close the pg pool so Vitest doesn't hang on the open connection (issue #1434).
afterAll(async () => {
  await pool.end()
})

describe("postTransaction (integration)", () => {
  it("posts a grant and the projection matches the entries", async () => {
    const { tenantId, walletId } = await setupTenant()
    await post(
      grant({ tenantId, walletId, credits: 100n, key: uniqueTenantId() })
    )

    expect(await balances.getWalletBalance(tenantId)).toBe(
      100n * UNITS_PER_CREDIT
    )
    expect(await balances.getBalance(walletId)).toBe(await sumEntries(walletId))
  })

  it("idempotent replay returns the original transaction and does not double-post", async () => {
    const { tenantId, walletId } = await setupTenant()
    const key = uniqueTenantId()
    const input = grant({ tenantId, walletId, credits: 100n, key })

    const first = await post(input)
    const replay = await ledger.postTransaction(input)

    expect(replay.id).toBe(first.id)
    expect(await balances.getWalletBalance(tenantId)).toBe(
      100n * UNITS_PER_CREDIT
    )
    const rows = await db
      .select()
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.idempotencyKey, key))
    expect(rows).toHaveLength(1)
  })

  it("concurrent posts of the same key write exactly one transaction", async () => {
    const { tenantId, walletId } = await setupTenant()
    const key = uniqueTenantId()
    const input = grant({ tenantId, walletId, credits: 100n, key })

    const results = await Promise.allSettled([
      ledger.postTransaction(input),
      ledger.postTransaction(input),
    ])
    // Either interleaving is acceptable: both replay-win (same id) or one
    // wins the unique insert and the other rejects DuplicateTransactionError.
    for (const r of results) {
      if (r.status === "rejected") {
        expect(r.reason).toBeInstanceOf(DuplicateTransactionError)
      } else {
        createdTxIds.push(r.value.id)
      }
    }
    const rows = await db
      .select()
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.idempotencyKey, key))
    expect(rows).toHaveLength(1)
    // The balance moved exactly once regardless of who won.
    expect(await balances.getWalletBalance(tenantId)).toBe(
      100n * UNITS_PER_CREDIT
    )
  })

  it("overspend rejects with InsufficientCreditsError and rolls back", async () => {
    const { tenantId, walletId } = await setupTenant()
    await post(
      grant({ tenantId, walletId, credits: 5n, key: uniqueTenantId() })
    )

    const overKey = uniqueTenantId()
    await expect(
      ledger.postTransaction(
        usage({ tenantId, walletId, credits: 10n, key: overKey })
      )
    ).rejects.toBeInstanceOf(InsufficientCreditsError)

    // Balance untouched, and no transaction row was written for the blocked key.
    expect(await balances.getWalletBalance(tenantId)).toBe(
      5n * UNITS_PER_CREDIT
    )
    const rows = await db
      .select()
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.idempotencyKey, overKey))
    expect(rows).toHaveLength(0)
  })

  it("lets a system account go negative (the negative guard is TENANT-only)", async () => {
    const { tenantId, walletId } = await setupTenant()
    // Granting credits drives CREDIT_ISSUANCE (a system account) negative.
    await post(
      grant({ tenantId, walletId, credits: 100n, key: uniqueTenantId() })
    )
    expect(await balances.getBalance(issuanceId)).toBeLessThan(0n)
  })

  it("rejects a transaction touching an unknown account and writes nothing", async () => {
    const { tenantId, walletId } = await setupTenant()
    const key = uniqueTenantId()
    // Balanced input (passes validation) but references a non-existent account,
    // so the existence check inside postTransaction must reject.
    const input: LedgerTransactionInput = {
      tenantId,
      type: "SUBSCRIPTION_GRANT",
      referenceType: "BILLING_CYCLE",
      referenceId: key,
      idempotencyKey: key,
      entries: [
        { accountId: walletId, amount: 1000n },
        { accountId: `ghost-${key}`, amount: -1000n },
      ],
    }
    await expect(ledger.postTransaction(input)).rejects.toBeInstanceOf(
      AccountNotFoundError
    )
    const rows = await db
      .select()
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.idempotencyKey, key))
    expect(rows).toHaveLength(0)
  })

  it("keeps the projection equal to SUM(entries) after a grant and a spend", async () => {
    const { tenantId, walletId } = await setupTenant()
    await post(
      grant({ tenantId, walletId, credits: 100n, key: uniqueTenantId() })
    )
    await post(
      usage({ tenantId, walletId, credits: 25n, key: uniqueTenantId() })
    )

    expect(await balances.getWalletBalance(tenantId)).toBe(
      75n * UNITS_PER_CREDIT
    )
    expect(await balances.getBalance(walletId)).toBe(await sumEntries(walletId))
    expect(await balances.getBalance(aiConsumedId)).toBe(
      await sumEntries(aiConsumedId)
    )
  })
})
