/**
 * Pure transaction builders — one per transaction type. The factory owns the
 * SIGN CONVENTION so business code can't get it wrong: callers always pass a
 * positive `credits` amount and say what happened; the factory decides which
 * side is negative. No DB: callers pass already-resolved account ids (resolved
 * from codes via AccountService). Every output satisfies `sumEntries === 0n`.
 */
import { creditsToUnits, TRANSACTION_TYPES } from "./types"
import type { LedgerTransactionInput } from "./types"

export const LedgerFactory = {
  /** Spend: TENANT_WALLET -N, AI_CONSUMED +N. */
  createAIUsage(p: {
    tenantId: string
    walletAccountId: string
    aiConsumedAccountId: string
    credits: bigint
    usageId: string
    idempotencyKey: string
    description?: string
  }): LedgerTransactionInput {
    const amount = creditsToUnits(p.credits)
    return {
      tenantId: p.tenantId,
      type: TRANSACTION_TYPES.AI_USAGE,
      referenceType: "AI_USAGE",
      referenceId: p.usageId,
      idempotencyKey: p.idempotencyKey,
      description: p.description,
      entries: [
        { accountId: p.walletAccountId, amount: -amount },
        { accountId: p.aiConsumedAccountId, amount },
      ],
    }
  },

  /** Grant from a subscription cycle: CREDIT_ISSUANCE -N, TENANT_WALLET +N. */
  createSubscriptionGrant(p: {
    tenantId: string
    issuanceAccountId: string
    walletAccountId: string
    credits: bigint
    billingCycleId: string
    idempotencyKey: string
    description?: string
  }): LedgerTransactionInput {
    const amount = creditsToUnits(p.credits)
    return {
      tenantId: p.tenantId,
      type: TRANSACTION_TYPES.SUBSCRIPTION_GRANT,
      referenceType: "BILLING_CYCLE",
      referenceId: p.billingCycleId,
      idempotencyKey: p.idempotencyKey,
      description: p.description,
      entries: [
        { accountId: p.issuanceAccountId, amount: -amount },
        { accountId: p.walletAccountId, amount },
      ],
    }
  },

  /** Purchase: CREDIT_ISSUANCE -N, TENANT_WALLET +N. */
  createCreditPurchase(p: {
    tenantId: string
    issuanceAccountId: string
    walletAccountId: string
    credits: bigint
    paymentId: string
    idempotencyKey: string
    description?: string
  }): LedgerTransactionInput {
    const amount = creditsToUnits(p.credits)
    return {
      tenantId: p.tenantId,
      type: TRANSACTION_TYPES.CREDIT_PURCHASE,
      referenceType: "STRIPE_PAYMENT",
      referenceId: p.paymentId,
      idempotencyKey: p.idempotencyKey,
      description: p.description,
      entries: [
        { accountId: p.issuanceAccountId, amount: -amount },
        { accountId: p.walletAccountId, amount },
      ],
    }
  },

  /** Refund consumed credits: AI_CONSUMED -N, TENANT_WALLET +N. */
  createRefund(p: {
    tenantId: string
    aiConsumedAccountId: string
    walletAccountId: string
    credits: bigint
    refundId: string
    idempotencyKey: string
    description?: string
  }): LedgerTransactionInput {
    const amount = creditsToUnits(p.credits)
    return {
      tenantId: p.tenantId,
      type: TRANSACTION_TYPES.REFUND,
      referenceType: "REFUND",
      referenceId: p.refundId,
      idempotencyKey: p.idempotencyKey,
      description: p.description,
      entries: [
        { accountId: p.aiConsumedAccountId, amount: -amount },
        { accountId: p.walletAccountId, amount },
      ],
    }
  },

  /** Expire credits: TENANT_WALLET -N, CREDIT_EXPIRED +N. No reference. */
  createExpiration(p: {
    tenantId: string
    walletAccountId: string
    creditExpiredAccountId: string
    credits: bigint
    idempotencyKey: string
    description?: string
  }): LedgerTransactionInput {
    const amount = creditsToUnits(p.credits)
    return {
      tenantId: p.tenantId,
      type: TRANSACTION_TYPES.EXPIRATION,
      idempotencyKey: p.idempotencyKey,
      description: p.description,
      entries: [
        { accountId: p.walletAccountId, amount: -amount },
        { accountId: p.creditExpiredAccountId, amount },
      ],
    }
  },

  /**
   * Admin adjustment. grant: ADJUSTMENT -N, TENANT_WALLET +N.
   * remove: TENANT_WALLET -N, ADJUSTMENT +N (the reverse).
   */
  createManualAdjustment(p: {
    tenantId: string
    adjustmentAccountId: string
    walletAccountId: string
    credits: bigint
    direction: "grant" | "remove"
    adminId: string
    idempotencyKey: string
    description?: string
  }): LedgerTransactionInput {
    const amount = creditsToUnits(p.credits)
    const walletAmount = p.direction === "grant" ? amount : -amount
    return {
      tenantId: p.tenantId,
      type: TRANSACTION_TYPES.MANUAL_ADJUSTMENT,
      referenceType: "ADMIN",
      referenceId: p.adminId,
      idempotencyKey: p.idempotencyKey,
      description: p.description,
      entries: [
        { accountId: p.adjustmentAccountId, amount: -walletAmount },
        { accountId: p.walletAccountId, amount: walletAmount },
      ],
    }
  },

  /** Move credits between two wallets: from -N, to +N. No reference. */
  createTransfer(p: {
    tenantId: string
    fromWalletAccountId: string
    toWalletAccountId: string
    credits: bigint
    idempotencyKey: string
    description?: string
  }): LedgerTransactionInput {
    const amount = creditsToUnits(p.credits)
    return {
      tenantId: p.tenantId,
      type: TRANSACTION_TYPES.TRANSFER,
      idempotencyKey: p.idempotencyKey,
      description: p.description,
      entries: [
        { accountId: p.fromWalletAccountId, amount: -amount },
        { accountId: p.toWalletAccountId, amount },
      ],
    }
  },
}
