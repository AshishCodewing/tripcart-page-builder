import { describe, expect, it } from "vitest"

import { LedgerBalanceError, LedgerValidationError } from "@/lib/ledger/errors"
import { LedgerValidator } from "@/lib/ledger/ledger.validator"
import type { LedgerTransactionInput } from "@/lib/ledger/types"

const validator = new LedgerValidator()

// A fresh known-good input each call, so a test mutating one field can't
// leak into the next.
function valid(): LedgerTransactionInput {
  return {
    tenantId: "tenant-1",
    type: "AI_USAGE",
    idempotencyKey: "key-1",
    entries: [
      { accountId: "wallet", amount: -25000n },
      { accountId: "ai", amount: 25000n },
    ],
  }
}

describe("LedgerValidator", () => {
  it("passes a valid two-entry balanced transaction", () => {
    expect(() => validator.validate(valid())).not.toThrow()
  })

  it("throws LedgerBalanceError when entries do not sum to zero", () => {
    const input = valid()
    input.entries[1].amount = 20000n
    expect(() => validator.validate(input)).toThrow(LedgerBalanceError)
  })

  it("throws LedgerValidationError for fewer than two entries", () => {
    const input = valid()
    input.entries = [{ accountId: "wallet", amount: -25000n }]
    // Also unbalanced, but the count check runs first — proves rule order.
    expect(() => validator.validate(input)).toThrow(LedgerValidationError)
  })

  it("throws LedgerValidationError for a zero-amount entry", () => {
    const input = valid()
    input.entries = [
      { accountId: "wallet", amount: 0n },
      { accountId: "ai", amount: 0n },
    ]
    expect(() => validator.validate(input)).toThrow(LedgerValidationError)
  })

  it("throws LedgerValidationError for a missing tenantId", () => {
    const input = valid()
    input.tenantId = ""
    expect(() => validator.validate(input)).toThrow(LedgerValidationError)
  })

  it("throws LedgerValidationError for a missing idempotencyKey", () => {
    const input = valid()
    input.idempotencyKey = ""
    expect(() => validator.validate(input)).toThrow(LedgerValidationError)
  })

  it("throws LedgerValidationError for a missing type", () => {
    const input = valid()
    input.type = ""
    expect(() => validator.validate(input)).toThrow(LedgerValidationError)
  })
})
