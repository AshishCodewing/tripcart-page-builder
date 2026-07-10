import { beforeEach, describe, expect, it, vi } from "vitest"

import { AccountNotFoundError, balances } from "@/lib/ledger"
import { prisma } from "@/lib/prisma"

import { hasCredits } from "./gate"
import { seedTenantCredits } from "./seed"

// gate.ts imports its collaborators directly (no DI), so mock at module level.
// Keep the real AccountNotFoundError from the actual module so the `instanceof`
// branch in gate.ts still matches.
vi.mock("@/lib/ledger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ledger")>()
  return { ...actual, balances: { getWalletBalance: vi.fn() } }
})
vi.mock("@/lib/prisma", () => ({
  prisma: { tenant: { findUnique: vi.fn() } },
}))
vi.mock("./seed", () => ({ seedTenantCredits: vi.fn() }))

const getWalletBalance = vi.mocked(balances.getWalletBalance)
const findUnique = vi.mocked(prisma.tenant.findUnique)
const seed = vi.mocked(seedTenantCredits)

describe("hasCredits", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    getWalletBalance.mockReset()
    findUnique.mockReset()
    seed.mockReset()
    // gate.ts logs on the fail-open paths; silence the expected noise.
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("returns true when the wallet balance is positive", async () => {
    getWalletBalance.mockResolvedValue(1n)
    await expect(hasCredits("tenant-1")).resolves.toBe(true)
    expect(seed).not.toHaveBeenCalled()
  })

  it("returns false when the wallet balance is zero", async () => {
    getWalletBalance.mockResolvedValue(0n)
    await expect(hasCredits("tenant-1")).resolves.toBe(false)
    expect(seed).not.toHaveBeenCalled()
  })

  it("returns false for an unknown tenant and does NOT seed", async () => {
    getWalletBalance.mockRejectedValue(new AccountNotFoundError("wallet:t"))
    findUnique.mockResolvedValue(null as never)

    await expect(hasCredits("tenant-1")).resolves.toBe(false)
    expect(seed).not.toHaveBeenCalled()
  })

  it("self-heals a real tenant: seeds once, then returns true on re-check", async () => {
    getWalletBalance
      .mockRejectedValueOnce(new AccountNotFoundError("wallet:t"))
      .mockResolvedValueOnce(200_000n)
    findUnique.mockResolvedValue({ id: "tenant-1" } as never)
    seed.mockResolvedValue(undefined as never)

    await expect(hasCredits("tenant-1")).resolves.toBe(true)
    expect(seed).toHaveBeenCalledOnce()
    expect(seed).toHaveBeenCalledWith("tenant-1")
  })

  it("fails open (true) when the self-heal seed rejects", async () => {
    getWalletBalance.mockRejectedValue(new AccountNotFoundError("wallet:t"))
    findUnique.mockResolvedValue({ id: "tenant-1" } as never)
    seed.mockRejectedValue(new Error("seed exploded"))

    await expect(hasCredits("tenant-1")).resolves.toBe(true)
  })

  it("fails open (true) on any non-AccountNotFound error", async () => {
    getWalletBalance.mockRejectedValue(new Error("db down"))
    await expect(hasCredits("tenant-1")).resolves.toBe(true)
    expect(seed).not.toHaveBeenCalled()
  })

  it("fails CLOSED (false) on a generic error when BILLING_GATE_FAIL_CLOSED=1", async () => {
    vi.stubEnv("BILLING_GATE_FAIL_CLOSED", "1")
    getWalletBalance.mockRejectedValue(new Error("db down"))
    await expect(hasCredits("tenant-1")).resolves.toBe(false)
  })

  it("fails CLOSED (false) on a self-heal seed failure when BILLING_GATE_FAIL_CLOSED=1", async () => {
    vi.stubEnv("BILLING_GATE_FAIL_CLOSED", "1")
    getWalletBalance.mockRejectedValue(new AccountNotFoundError("wallet:t"))
    findUnique.mockResolvedValue({ id: "tenant-1" } as never)
    seed.mockRejectedValue(new Error("seed exploded"))
    await expect(hasCredits("tenant-1")).resolves.toBe(false)
  })
})
