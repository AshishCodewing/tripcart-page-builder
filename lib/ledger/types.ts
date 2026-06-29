/**
 * Pure ledger types + constants. No Prisma imports — these are the shapes and
 * vocabulary the rest of `lib/ledger` shares. Money is `bigint` units
 * end-to-end (`1 credit = 1000 units`); conversion happens at the edges only.
 */

// ── Chart of accounts ──
// System accounts are platform-owned (one of each globally, tenantId = null).
// TENANT_WALLET is the one per-tenant account.
export const ACCOUNT_CODES = {
  CREDIT_ISSUANCE: "CREDIT_ISSUANCE",
  AI_CONSUMED: "AI_CONSUMED",
  CREDIT_EXPIRED: "CREDIT_EXPIRED",
  ADJUSTMENT: "ADJUSTMENT",
  TENANT_WALLET: "TENANT_WALLET",
} as const

export type AccountCode = (typeof ACCOUNT_CODES)[keyof typeof ACCOUNT_CODES]

/** The four platform-owned system codes (everything except TENANT_WALLET). */
export const SYSTEM_ACCOUNT_CODES = [
  ACCOUNT_CODES.CREDIT_ISSUANCE,
  ACCOUNT_CODES.AI_CONSUMED,
  ACCOUNT_CODES.CREDIT_EXPIRED,
  ACCOUNT_CODES.ADJUSTMENT,
] as const

export type SystemAccountCode = (typeof SYSTEM_ACCOUNT_CODES)[number]

// ── Transaction types ──
export const TRANSACTION_TYPES = {
  AI_USAGE: "AI_USAGE",
  SUBSCRIPTION_GRANT: "SUBSCRIPTION_GRANT",
  CREDIT_PURCHASE: "CREDIT_PURCHASE",
  REFUND: "REFUND",
  EXPIRATION: "EXPIRATION",
  MANUAL_ADJUSTMENT: "MANUAL_ADJUSTMENT",
  TRANSFER: "TRANSFER",
} as const

export type TransactionType =
  (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES]

// ── Unit scale ──
/** `1 credit = 1000 units`. We store integer units in a BIGINT column. */
export const UNITS_PER_CREDIT = 1000n

/**
 * Convert a positive, whole credit amount to units. Conversion lives at the
 * edges (factories) only — the ledger core deals exclusively in units.
 *
 * @throws if `credits` is not a positive integer `bigint`.
 */
export function creditsToUnits(credits: bigint): bigint {
  if (typeof credits !== "bigint") {
    throw new TypeError("credits must be a bigint")
  }
  if (credits <= 0n) {
    throw new RangeError("credits must be a positive amount")
  }
  return credits * UNITS_PER_CREDIT
}

// ── Service input shapes ──
export interface LedgerEntryInput {
  accountId: string
  amount: bigint // signed units; + increases, - decreases
}

export interface LedgerTransactionInput {
  tenantId: string
  type: string
  referenceType?: string
  referenceId?: string
  description?: string
  idempotencyKey: string
  entries: LedgerEntryInput[]
}

// ── Result shape ──
export interface PostedEntry {
  id: string
  accountId: string
  amount: bigint
}

export interface PostedTransaction {
  id: string
  type: string
  entries: PostedEntry[]
  createdAt: Date
}
