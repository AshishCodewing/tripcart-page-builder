/**
 * The data-access boundary — the ONLY file that touches ledger tables. No
 * business logic, no validation: it reads and writes rows, nothing more. Every
 * method takes a `db` so the caller controls the connection: the service hands
 * in its `tx` (so lock + insert + balance update share one atomic transaction),
 * while plain reads pass the full Drizzle client (both satisfy `Db`).
 */
import { and, eq, inArray, isNull, sql, sum } from "drizzle-orm"

import type { Db } from "@/lib/db"
import {
  accountBalances,
  ledgerAccounts,
  ledgerEntries,
  ledgerTransactions,
} from "@/lib/schema"
import type {
  AccountBalance,
  LedgerAccount,
  LedgerAccountType,
} from "@/lib/schema"
import { isUniqueViolation } from "./pg-error"
import type { LedgerTransactionInput } from "./types"

// A transaction row with its entries eagerly loaded — the shape the service
// maps into a PostedTransaction.
export type TransactionWithEntries = typeof ledgerTransactions.$inferSelect & {
  entries: (typeof ledgerEntries.$inferSelect)[]
}

export class LedgerRepository {
  /** Idempotency lookup — the tx + entries for a key, or null. */
  async findTransactionByIdempotencyKey(
    db: Db,
    key: string
  ): Promise<TransactionWithEntries | null> {
    const row = await db.query.ledgerTransactions.findFirst({
      where: eq(ledgerTransactions.idempotencyKey, key),
      with: { entries: true },
    })
    return row ?? null
  }

  /** Bulk-fetch accounts so the service can check existence + read accountType. */
  findAccountsByIds(db: Db, ids: string[]): Promise<LedgerAccount[]> {
    if (ids.length === 0) return Promise.resolve([])
    return db
      .select()
      .from(ledgerAccounts)
      .where(inArray(ledgerAccounts.id, ids))
  }

  /**
   * Resolve a single account by tenant + code. tenantId may be null (system
   * accounts) whose global uniqueness is the partial index; the null case
   * compiles to `IS NULL`. Shared by both services.
   */
  async findAccount(
    db: Db,
    params: { tenantId: string | null; accountCode: string }
  ): Promise<LedgerAccount | null> {
    const rows = await db
      .select()
      .from(ledgerAccounts)
      .where(
        and(
          params.tenantId === null
            ? isNull(ledgerAccounts.tenantId)
            : eq(ledgerAccounts.tenantId, params.tenantId),
          eq(ledgerAccounts.accountCode, params.accountCode)
        )
      )
      .limit(1)
    return rows[0] ?? null
  }

  /**
   * The FOR UPDATE row lock — raw SQL because Drizzle's query builder has no
   * first-class row lock in this position. Returns a map of accountId ->
   * current balance. node-postgres returns BIGINT as a string, so coerce.
   */
  async lockBalances(
    db: Db,
    accountIds: string[]
  ): Promise<Map<string, bigint>> {
    // Empty list — nothing to lock, return an empty map.
    if (accountIds.length === 0) return new Map()
    const idList = sql.join(
      accountIds.map((id) => sql`${id}`),
      sql`, `
    )
    const { rows } = await db.execute<{ accountId: string; balance: string }>(sql`
      SELECT "accountId", "balance" FROM "account_balances"
      WHERE "accountId" IN (${idList})
      FOR UPDATE`)
    return new Map(rows.map((r) => [r.accountId, BigInt(r.balance)]))
  }

  /**
   * Create the transaction with its entries. Prisma did this as one nested
   * write; Drizzle inserts the parent then the children and composes the
   * eager-loaded shape from the RETURNING rows. Maps the input's `type` onto
   * the `transactionType` column (the one rename).
   */
  async insertTransaction(
    db: Db,
    input: LedgerTransactionInput
  ): Promise<TransactionWithEntries> {
    const [txRow] = await db
      .insert(ledgerTransactions)
      .values({
        tenantId: input.tenantId,
        transactionType: input.type,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        description: input.description,
        idempotencyKey: input.idempotencyKey,
      })
      .returning()

    const entries = input.entries.length
      ? await db
          .insert(ledgerEntries)
          .values(
            input.entries.map((e) => ({
              transactionId: txRow.id,
              accountId: e.accountId,
              amount: e.amount,
            }))
          )
          .returning()
      : []

    return { ...txRow, entries }
  }

  /** Write the balance projection for one account. */
  async upsertBalance(
    db: Db,
    accountId: string,
    balance: bigint
  ): Promise<AccountBalance> {
    const [row] = await db
      .insert(accountBalances)
      .values({ accountId, balance })
      .onConflictDoUpdate({
        target: accountBalances.accountId,
        set: { balance },
      })
      .returning()
    return row
  }

  /**
   * Create an account and seed its balance row at 0 (so FOR UPDATE always has a
   * row to lock), atomically. Tolerant of the unique constraint: on a
   * concurrent-create race the loser gets 23505 and we return the existing row.
   */
  async createAccount(
    db: Db,
    params: {
      tenantId: string | null
      accountCode: string
      accountType: LedgerAccountType
    }
  ): Promise<LedgerAccount> {
    try {
      return await db.transaction(async (tx) => {
        const [account] = await tx
          .insert(ledgerAccounts)
          .values({
            tenantId: params.tenantId,
            accountCode: params.accountCode,
            accountType: params.accountType,
          })
          .returning()
        await tx.insert(accountBalances).values({ accountId: account.id })
        return account
      })
    } catch (e) {
      if (isUniqueViolation(e)) {
        const existing = await this.findAccount(db, {
          tenantId: params.tenantId,
          accountCode: params.accountCode,
        })
        if (existing) return existing
      }
      throw e
    }
  }

  /** Read the projection row for one account (BalanceService). */
  async getBalanceRow(
    db: Db,
    accountId: string
  ): Promise<AccountBalance | null> {
    const row = await db.query.accountBalances.findFirst({
      where: eq(accountBalances.accountId, accountId),
    })
    return row ?? null
  }

  /** Ground truth: SUM(entries.amount) for one account (BalanceService). */
  async sumEntriesForAccount(db: Db, accountId: string): Promise<bigint> {
    const [row] = await db
      .select({ total: sum(ledgerEntries.amount) })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.accountId, accountId))
    // `sum()` comes back as a numeric string (or null for no rows).
    return row?.total ? BigInt(row.total) : 0n
  }
}
