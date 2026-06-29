/**
 * Typed ledger errors. All extend {@link LedgerError} so callers can branch on
 * "any ledger problem" with a single `instanceof LedgerError`, or narrow to a
 * specific failure. Each subclass carries a sensible default message and lets
 * callers pass detail to override it.
 */
export class LedgerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

/** Missing key/tenant/type, `< 2` entries, or a zero amount. */
export class LedgerValidationError extends LedgerError {
  constructor(message = "Ledger transaction failed validation") {
    super(message)
  }
}

/** Entries don't sum to zero. */
export class LedgerBalanceError extends LedgerError {
  constructor(message = "Ledger entries do not sum to zero") {
    super(message)
  }
}

/** A `TENANT_WALLET` would go negative. */
export class InsufficientCreditsError extends LedgerError {
  constructor(message = "Wallet has insufficient credits") {
    super(message)
  }
}

/** Concurrent idempotency-key collision (the racing twin that lost). */
export class DuplicateTransactionError extends LedgerError {
  constructor(
    message = "A transaction with this idempotency key already exists"
  ) {
    super(message)
  }
}

/** An entry references a non-existent account. */
export class AccountNotFoundError extends LedgerError {
  constructor(message = "Ledger account not found") {
    super(message)
  }
}
