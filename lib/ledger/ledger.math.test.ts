import { describe, expect, it } from "vitest"

import { computeDeltas, sumEntries } from "@/lib/ledger/ledger.math"

describe("sumEntries", () => {
  it("sums a balanced set to zero", () => {
    const entries = [
      { accountId: "wallet", amount: -25000n },
      { accountId: "ai", amount: 25000n },
    ]
    expect(sumEntries(entries)).toBe(0n)
  })

  it("returns the exact non-zero remainder of an unbalanced set", () => {
    const entries = [
      { accountId: "wallet", amount: -25000n },
      { accountId: "ai", amount: 20000n },
    ]
    expect(sumEntries(entries)).toBe(-5000n)
  })

  it("sums an empty set to zero", () => {
    expect(sumEntries([])).toBe(0n)
  })
})

describe("computeDeltas", () => {
  it("nets each account in a simple two-account transaction", () => {
    const deltas = computeDeltas([
      { accountId: "wallet", amount: -25000n },
      { accountId: "ai", amount: 25000n },
    ])
    expect(deltas.size).toBe(2)
    expect(deltas.get("wallet")).toBe(-25000n)
    expect(deltas.get("ai")).toBe(25000n)
  })

  it("accumulates a repeated account instead of overwriting it", () => {
    const deltas = computeDeltas([
      { accountId: "wallet", amount: 100n },
      { accountId: "ai", amount: -100n },
      { accountId: "wallet", amount: -30n },
      { accountId: "ai", amount: 30n },
    ])
    expect(deltas.size).toBe(2)
    expect(deltas.get("wallet")).toBe(70n)
    expect(deltas.get("ai")).toBe(-70n)
  })
})
