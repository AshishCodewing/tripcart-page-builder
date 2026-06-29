import { describe, expect, it } from "vitest"

import { sumEntries } from "@/lib/ledger/ledger.math"
import { LedgerFactory } from "@/lib/ledger/transaction.factory"
import type { LedgerTransactionInput } from "@/lib/ledger/types"

// Grab an entry by account id so tests don't depend on entry ordering.
function amountFor(tx: LedgerTransactionInput, accountId: string): bigint {
  const entry = tx.entries.find((e) => e.accountId === accountId)
  if (!entry) throw new Error(`no entry for ${accountId}`)
  return entry.amount
}

describe("LedgerFactory.createAIUsage", () => {
  const tx = LedgerFactory.createAIUsage({
    tenantId: "tenant-1",
    walletAccountId: "wallet",
    aiConsumedAccountId: "ai",
    credits: 25n,
    usageId: "usage-1",
    idempotencyKey: "key-1",
  })

  it("converts credits to units (25 -> 25000)", () => {
    expect(amountFor(tx, "ai")).toBe(25000n)
  })

  it("debits the wallet and credits ai-consumed", () => {
    expect(amountFor(tx, "wallet")).toBe(-25000n)
    expect(amountFor(tx, "ai")).toBe(25000n)
  })

  it("rejects a zero credit amount", () => {
    expect(() =>
      LedgerFactory.createAIUsage({
        tenantId: "tenant-1",
        walletAccountId: "wallet",
        aiConsumedAccountId: "ai",
        credits: 0n,
        usageId: "usage-1",
        idempotencyKey: "key-1",
      })
    ).toThrow()
  })

  it("rejects a negative credit amount", () => {
    expect(() =>
      LedgerFactory.createAIUsage({
        tenantId: "tenant-1",
        walletAccountId: "wallet",
        aiConsumedAccountId: "ai",
        credits: -5n,
        usageId: "usage-1",
        idempotencyKey: "key-1",
      })
    ).toThrow()
  })
})

describe("LedgerFactory sign conventions", () => {
  it("createSubscriptionGrant: issuance -N, wallet +N", () => {
    const tx = LedgerFactory.createSubscriptionGrant({
      tenantId: "t",
      issuanceAccountId: "issuance",
      walletAccountId: "wallet",
      credits: 10n,
      billingCycleId: "cycle-1",
      idempotencyKey: "k",
    })
    expect(amountFor(tx, "issuance")).toBe(-10000n)
    expect(amountFor(tx, "wallet")).toBe(10000n)
  })

  it("createRefund: ai-consumed -N, wallet +N", () => {
    const tx = LedgerFactory.createRefund({
      tenantId: "t",
      aiConsumedAccountId: "ai",
      walletAccountId: "wallet",
      credits: 10n,
      refundId: "refund-1",
      idempotencyKey: "k",
    })
    expect(amountFor(tx, "ai")).toBe(-10000n)
    expect(amountFor(tx, "wallet")).toBe(10000n)
  })

  it("createManualAdjustment grant: wallet +N", () => {
    const tx = LedgerFactory.createManualAdjustment({
      tenantId: "t",
      adjustmentAccountId: "adjustment",
      walletAccountId: "wallet",
      credits: 10n,
      direction: "grant",
      adminId: "admin-1",
      idempotencyKey: "k",
    })
    expect(amountFor(tx, "wallet")).toBe(10000n)
    expect(amountFor(tx, "adjustment")).toBe(-10000n)
  })

  it("createManualAdjustment remove: wallet -N", () => {
    const tx = LedgerFactory.createManualAdjustment({
      tenantId: "t",
      adjustmentAccountId: "adjustment",
      walletAccountId: "wallet",
      credits: 10n,
      direction: "remove",
      adminId: "admin-1",
      idempotencyKey: "k",
    })
    expect(amountFor(tx, "wallet")).toBe(-10000n)
    expect(amountFor(tx, "adjustment")).toBe(10000n)
  })
})

// The invariant: EVERY factory output balances to zero. Add a factory -> add a
// row here. MANUAL_ADJUSTMENT appears twice (both directions must balance).
describe("invariant: every factory output sums to zero", () => {
  const outputs: [string, LedgerTransactionInput][] = [
    [
      "AI_USAGE",
      LedgerFactory.createAIUsage({
        tenantId: "t",
        walletAccountId: "wallet",
        aiConsumedAccountId: "ai",
        credits: 25n,
        usageId: "u",
        idempotencyKey: "k1",
      }),
    ],
    [
      "SUBSCRIPTION_GRANT",
      LedgerFactory.createSubscriptionGrant({
        tenantId: "t",
        issuanceAccountId: "issuance",
        walletAccountId: "wallet",
        credits: 100n,
        billingCycleId: "c",
        idempotencyKey: "k2",
      }),
    ],
    [
      "CREDIT_PURCHASE",
      LedgerFactory.createCreditPurchase({
        tenantId: "t",
        issuanceAccountId: "issuance",
        walletAccountId: "wallet",
        credits: 100n,
        paymentId: "p",
        idempotencyKey: "k3",
      }),
    ],
    [
      "REFUND",
      LedgerFactory.createRefund({
        tenantId: "t",
        aiConsumedAccountId: "ai",
        walletAccountId: "wallet",
        credits: 5n,
        refundId: "r",
        idempotencyKey: "k4",
      }),
    ],
    [
      "EXPIRATION",
      LedgerFactory.createExpiration({
        tenantId: "t",
        walletAccountId: "wallet",
        creditExpiredAccountId: "expired",
        credits: 5n,
        idempotencyKey: "k5",
      }),
    ],
    [
      "MANUAL_ADJUSTMENT grant",
      LedgerFactory.createManualAdjustment({
        tenantId: "t",
        adjustmentAccountId: "adjustment",
        walletAccountId: "wallet",
        credits: 5n,
        direction: "grant",
        adminId: "a",
        idempotencyKey: "k6",
      }),
    ],
    [
      "MANUAL_ADJUSTMENT remove",
      LedgerFactory.createManualAdjustment({
        tenantId: "t",
        adjustmentAccountId: "adjustment",
        walletAccountId: "wallet",
        credits: 5n,
        direction: "remove",
        adminId: "a",
        idempotencyKey: "k7",
      }),
    ],
    [
      "TRANSFER",
      LedgerFactory.createTransfer({
        tenantId: "t",
        fromWalletAccountId: "wallet-a",
        toWalletAccountId: "wallet-b",
        credits: 5n,
        idempotencyKey: "k8",
      }),
    ],
  ]

  it.each(outputs)("%s balances to zero", (_label, tx) => {
    expect(sumEntries(tx.entries)).toBe(0n)
  })
})
