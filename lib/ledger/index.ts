/**
 * Composition root + public API for the credit ledger.
 *
 * Business code imports ONLY from here — never from ./ledger.repository or
 * the ledger tables directly. The repository and service classes are
 * intentionally not exported; the only way to reach them is through a
 * createLedger() bundle, which is what keeps the write path funnelled through
 * LedgerService.postTransaction.
 */
import { db } from "@/lib/db"
import type { Database } from "@/lib/db"
import { AccountService } from "./account.service"
import { BalanceService } from "./balance.service"
import { LedgerRepository } from "./ledger.repository"
import { LedgerService } from "./ledger.service"
import { LedgerValidator } from "./ledger.validator"

/**
 * Wire the object graph. Pass a custom client (e.g. a test database) to point
 * the whole ledger at a different connection; defaults to the app singleton.
 */
export function createLedger(client: Database = db) {
  const repository = new LedgerRepository()
  const validator = new LedgerValidator()
  const accounts = new AccountService(client, repository)
  const balances = new BalanceService(client, repository)
  const ledger = new LedgerService(client, repository, validator)
  return { ledger, accounts, balances }
}

/** The wired bundle type, for passing the ledger around. */
export type Ledger = ReturnType<typeof createLedger>

/** Convenience instance bound to the app's Drizzle client. */
export const { ledger, accounts, balances } = createLedger()

// Public surface — types/constants, errors, and the transaction factory.
export * from "./types"
export * from "./errors"
export { LedgerFactory } from "./transaction.factory"
