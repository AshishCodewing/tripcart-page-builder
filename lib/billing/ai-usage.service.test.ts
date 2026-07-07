import { beforeEach, describe, expect, it, vi } from "vitest"

import { chargeAiUsage } from "@/lib/billing/ai-usage.service"
import type { BillingLedgerDeps } from "@/lib/billing/ai-usage.service"
import {
  DuplicateTransactionError,
  InsufficientCreditsError,
} from "@/lib/ledger/errors"
import type { LedgerTransactionInput } from "@/lib/ledger/types"

// A fresh fake bundle per test — the service caches resolved account ids in a
// WeakMap keyed on the accounts object, so new objects mean a cold cache.
function makeDeps(overrides?: {
  postTransaction?: (tx: LedgerTransactionInput) => Promise<unknown>
  walletBalance?: bigint
}) {
  const posted: LedgerTransactionInput[] = []
  const deps: BillingLedgerDeps = {
    ledger: {
      postTransaction: vi.fn(async (tx: LedgerTransactionInput) => {
        if (overrides?.postTransaction) {
          await overrides.postTransaction(tx)
        }
        posted.push(tx)
        return {
          id: `tx-${posted.length}`,
          type: tx.type,
          entries: [],
          createdAt: new Date(),
        }
      }),
    },
    accounts: {
      ensureSystemAccounts: vi.fn(async () => {}),
      getSystemAccountId: vi.fn(async () => "sys-ai-consumed"),
      ensureTenantWallet: vi.fn(),
      getTenantWalletId: vi.fn(async () => "wallet-1"),
    } as unknown as BillingLedgerDeps["accounts"],
    balances: {
      getWalletBalance: vi.fn(async () => overrides?.walletBalance ?? 0n),
    },
  }
  return { deps, posted }
}

const baseInput = {
  tenantId: "tenant-1",
  model: "openai/gpt-5-mini",
  inputTokens: 8000,
  outputTokens: 2000,
  usageId: "usage-abc",
  source: "copilot" as const,
  threadId: "thread-1",
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("chargeAiUsage", () => {
  it("charges computed credits with the ai-usage idempotency key", async () => {
    const { deps, posted } = makeDeps()
    const result = await chargeAiUsage(baseInput, deps)

    expect(result.status).toBe("charged")
    expect(result.credits).toBeGreaterThan(0n)
    expect(posted).toHaveLength(1)
    expect(posted[0].idempotencyKey).toBe("ai-usage:usage-abc")
    expect(posted[0].referenceId).toBe("usage-abc")
    // Wallet entry is the negative side, sized credits × 1000 units.
    const walletEntry = posted[0].entries.find(
      (e) => e.accountId === "wallet-1"
    )
    expect(walletEntry?.amount).toBe(-result.credits * 1000n)
  })

  it("skips zero-usage runs without touching the ledger", async () => {
    const { deps, posted } = makeDeps()
    const result = await chargeAiUsage(
      { ...baseInput, inputTokens: 0, outputTokens: 0 },
      deps
    )
    expect(result).toEqual({ status: "skipped_zero", credits: 0n })
    expect(posted).toHaveLength(0)
  })

  it("treats an idempotent duplicate as success", async () => {
    const { deps } = makeDeps({
      postTransaction: async () => {
        throw new DuplicateTransactionError()
      },
    })
    const result = await chargeAiUsage(baseInput, deps)
    expect(result.status).toBe("charged")
  })

  it("clamps to the remaining balance on insufficient credits", async () => {
    let calls = 0
    const { deps, posted } = makeDeps({
      walletBalance: 5_500n, // 5.5 credits left → clamp to 5
      postTransaction: async () => {
        calls += 1
        if (calls === 1) throw new InsufficientCreditsError()
      },
    })
    const result = await chargeAiUsage(baseInput, deps)

    expect(result).toEqual({ status: "clamped", credits: 5n })
    expect(posted).toHaveLength(1)
    expect(posted[0].idempotencyKey).toBe("ai-usage:usage-abc:clamped")
    expect(posted[0].description).toContain("CLAMPED")
  })

  it("writes off when the wallet is already empty", async () => {
    const { deps, posted } = makeDeps({
      walletBalance: 900n, // <1 whole credit
      postTransaction: async () => {
        throw new InsufficientCreditsError()
      },
    })
    const result = await chargeAiUsage(baseInput, deps)
    expect(result).toEqual({ status: "written_off", credits: 0n })
    expect(posted).toHaveLength(0)
  })

  it("writes off when a concurrent drain wins the clamp race", async () => {
    const { deps } = makeDeps({
      walletBalance: 5_000n,
      postTransaction: async () => {
        throw new InsufficientCreditsError() // both attempts fail
      },
    })
    const result = await chargeAiUsage(baseInput, deps)
    expect(result).toEqual({ status: "written_off", credits: 0n })
  })

  it("never throws — unexpected errors become write-offs", async () => {
    const { deps } = makeDeps({
      postTransaction: async () => {
        throw new Error("db exploded")
      },
    })
    await expect(chargeAiUsage(baseInput, deps)).resolves.toEqual({
      status: "written_off",
      credits: 0n,
    })
    expect(console.error).toHaveBeenCalled()
  })

  it("self-heals a missing wallet via ensureTenantWallet", async () => {
    const { deps, posted } = makeDeps()
    const accounts = deps.accounts as unknown as {
      getTenantWalletId: ReturnType<typeof vi.fn>
      ensureTenantWallet: ReturnType<typeof vi.fn>
    }
    const { AccountNotFoundError } = await import("@/lib/ledger/errors")
    accounts.getTenantWalletId.mockRejectedValueOnce(new AccountNotFoundError())
    accounts.ensureTenantWallet.mockResolvedValueOnce({ id: "wallet-new" })

    const result = await chargeAiUsage(baseInput, deps)
    expect(result.status).toBe("charged")
    expect(posted[0].entries.some((e) => e.accountId === "wallet-new")).toBe(
      true
    )
  })
})
