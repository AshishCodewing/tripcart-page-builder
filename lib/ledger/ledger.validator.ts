/**
 * Pure, structural validation — everything checkable from the input alone,
 * before any DB work. Account existence and the negative-wallet rule are NOT
 * here: they need the current DB state and live in the service, inside the
 * transaction. Stateless; injected into the service for composition/testing.
 */
import { LedgerBalanceError, LedgerValidationError } from "./errors"
import { sumEntries } from "./ledger.math"
import type { LedgerTransactionInput } from "./types"

export class LedgerValidator {
  /**
   * Throws on the first broken rule (fail-fast), else returns silently.
   * Order is coarse → fine so we never inspect entries of a malformed shell.
   */
  validate(input: LedgerTransactionInput): void {
    // Rule 1 — top-level fields present (truthy also rejects empty strings).
    if (!input.tenantId) {
      throw new LedgerValidationError("tenantId is required")
    }
    if (!input.idempotencyKey) {
      throw new LedgerValidationError("idempotencyKey is required")
    }
    if (!input.type) {
      throw new LedgerValidationError("type is required")
    }

    // Rule 2 — double-entry needs at least two entries.
    if (input.entries.length < 2) {
      throw new LedgerValidationError(
        "a transaction requires at least two entries"
      )
    }

    // Rule 3 — each entry is well-formed. typeof guards the trust boundary:
    // a stray `number` would otherwise crash the bigint math later.
    for (const entry of input.entries) {
      if (!entry.accountId) {
        throw new LedgerValidationError("each entry requires an accountId")
      }
      if (typeof entry.amount !== "bigint") {
        throw new LedgerValidationError("entry amount must be a bigint")
      }
      if (entry.amount === 0n) {
        throw new LedgerValidationError("entry amount must be non-zero")
      }
    }

    // Rule 4 — the double-entry law: entries must net to zero.
    if (sumEntries(input.entries) !== 0n) {
      throw new LedgerBalanceError()
    }
  }
}
