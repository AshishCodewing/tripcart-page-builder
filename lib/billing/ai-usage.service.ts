/**
 * Post one AI request's token usage to the credit ledger.
 *
 * Contract: NEVER throws — billing must not break the user's response. Every
 * failure path degrades to a structured log line and a status the caller can
 * ignore. Charging is idempotent per `usageId` (the ledger's idempotency key),
 * so retries and duplicate terminal hooks can't double-charge.
 *
 * Insufficient balance at charge time is the documented Option A window
 * (docs/reference/ai-usage-billing-gap.md): the pre-check passed, the request
 * ran, and the wallet can't cover the actual cost. We CLAMP — charge whatever
 * whole credits remain (draining the wallet so the next pre-check 402s) and
 * write off the shortfall. The ledger's negative guard stays untouched.
 */
import {
  ACCOUNT_CODES,
  AccountNotFoundError,
  accounts,
  balances,
  DuplicateTransactionError,
  InsufficientCreditsError,
  ledger,
  LedgerFactory,
  UNITS_PER_CREDIT,
} from "@/lib/ledger"
import type { Ledger } from "@/lib/ledger"
import { unitsToCredits, usageToUnits } from "./pricing"

/** The slice of the ledger bundle billing needs — narrow so tests can fake it. */
export interface BillingLedgerDeps {
  ledger: Pick<Ledger["ledger"], "postTransaction">
  accounts: Pick<
    Ledger["accounts"],
    | "ensureSystemAccounts"
    | "getSystemAccountId"
    | "ensureTenantWallet"
    | "getTenantWalletId"
  >
  balances: Pick<Ledger["balances"], "getWalletBalance">
}

const defaultDeps: BillingLedgerDeps = { ledger, accounts, balances }

export interface ChargeAiUsageInput {
  tenantId: string
  model: string
  inputTokens: number
  outputTokens: number
  /**
   * Provider-reported cost in micro-USD (summed across iterations by the
   * middleware). Preferred over MODEL_RATES when present and positive;
   * absent when any iteration failed to report a cost.
   */
  reportedMicroUsd?: bigint
  /** Server-generated UUID — becomes the ledger reference + idempotency key. */
  usageId: string
  source: "copilot" | "codegen"
  threadId?: string
}

export interface ChargeAiUsageResult {
  status: "charged" | "clamped" | "written_off" | "skipped_zero"
  credits: bigint
}

// Success-only caches, keyed on the accounts service instance so injected
// test fakes never share entries with the real bundle.
const systemIdCache = new WeakMap<object, string>()
const walletIdCache = new WeakMap<object, Map<string, string>>()

async function resolveAccountIds(
  deps: BillingLedgerDeps,
  tenantId: string
): Promise<{ aiConsumedId: string; walletId: string }> {
  let aiConsumedId = systemIdCache.get(deps.accounts)
  if (!aiConsumedId) {
    try {
      aiConsumedId = await deps.accounts.getSystemAccountId(
        ACCOUNT_CODES.AI_CONSUMED
      )
    } catch (e) {
      if (!(e instanceof AccountNotFoundError)) throw e
      await deps.accounts.ensureSystemAccounts()
      aiConsumedId = await deps.accounts.getSystemAccountId(
        ACCOUNT_CODES.AI_CONSUMED
      )
    }
    systemIdCache.set(deps.accounts, aiConsumedId)
  }

  let wallets = walletIdCache.get(deps.accounts)
  if (!wallets) {
    wallets = new Map()
    walletIdCache.set(deps.accounts, wallets)
  }
  let walletId = wallets.get(tenantId)
  if (!walletId) {
    try {
      walletId = await deps.accounts.getTenantWalletId(tenantId)
    } catch (e) {
      if (!(e instanceof AccountNotFoundError)) throw e
      walletId = (await deps.accounts.ensureTenantWallet(tenantId)).id
    }
    wallets.set(tenantId, walletId)
  }

  return { aiConsumedId, walletId }
}

export async function chargeAiUsage(
  input: ChargeAiUsageInput,
  deps: BillingLedgerDeps = defaultDeps
): Promise<ChargeAiUsageResult> {
  try {
    const { units, microUsdCost, pricedFrom } = usageToUnits(input)
    const credits = unitsToCredits(units)
    if (credits === 0n) {
      console.warn(
        `[billing] ${input.source} run ${input.usageId} reported zero usage — nothing charged`
      )
      return { status: "skipped_zero", credits: 0n }
    }

    const { aiConsumedId, walletId } = await resolveAccountIds(
      deps,
      input.tenantId
    )
    const description =
      `${input.source} ${input.model} ` +
      `${input.inputTokens}in/${input.outputTokens}out ` +
      `cost=${microUsdCost}µ$ (${pricedFrom})` +
      (input.threadId ? ` thread=${input.threadId}` : "")

    try {
      await deps.ledger.postTransaction(
        LedgerFactory.createAIUsage({
          tenantId: input.tenantId,
          walletAccountId: walletId,
          aiConsumedAccountId: aiConsumedId,
          credits,
          usageId: input.usageId,
          idempotencyKey: `ai-usage:${input.usageId}`,
          description,
        })
      )
      return { status: "charged", credits }
    } catch (e) {
      if (e instanceof DuplicateTransactionError) {
        return { status: "charged", credits }
      }
      if (!(e instanceof InsufficientCreditsError)) throw e

      // Option A shortfall: charge what's left, write off the rest.
      const balance = await deps.balances.getWalletBalance(input.tenantId)
      const clampedCredits = balance / UNITS_PER_CREDIT // floor
      if (clampedCredits <= 0n) {
        console.error(
          `[billing] write-off: tenant ${input.tenantId} owes ${credits} credits for ${input.usageId} but wallet is empty`
        )
        return { status: "written_off", credits: 0n }
      }
      try {
        await deps.ledger.postTransaction(
          LedgerFactory.createAIUsage({
            tenantId: input.tenantId,
            walletAccountId: walletId,
            aiConsumedAccountId: aiConsumedId,
            credits: clampedCredits,
            usageId: input.usageId,
            idempotencyKey: `ai-usage:${input.usageId}:clamped`,
            description: `${description} CLAMPED from ${credits} credits`,
          })
        )
        console.error(
          `[billing] clamped: tenant ${input.tenantId} charged ${clampedCredits}/${credits} credits for ${input.usageId}`
        )
        return { status: "clamped", credits: clampedCredits }
      } catch (e2) {
        if (e2 instanceof DuplicateTransactionError) {
          return { status: "clamped", credits: clampedCredits }
        }
        // A concurrent drain won the race — nothing left to take.
        console.error(
          `[billing] write-off after clamp race: tenant ${input.tenantId}, usage ${input.usageId}`,
          e2
        )
        return { status: "written_off", credits: 0n }
      }
    }
  } catch (error) {
    console.error(
      `[billing] charge failed (response unaffected): tenant ${input.tenantId}, ` +
        `usage ${input.usageId}, model ${input.model}, ` +
        `${input.inputTokens}in/${input.outputTokens}out`,
      error
    )
    return { status: "written_off", credits: 0n }
  }
}
