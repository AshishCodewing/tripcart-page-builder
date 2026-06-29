/**
 * The data-access boundary — the ONLY file that touches ledger tables. No
 * business logic, no validation: it reads and writes rows, nothing more. Every
 * method takes a `db` so the caller controls the connection: the service hands
 * in its `tx` (so lock + insert + balance update share one atomic transaction),
 * while plain reads pass the full PrismaClient (assignable to TransactionClient).
 */
import { Prisma } from "@/generated/prisma/client"
import type {
  AccountBalance,
  LedgerAccount,
  LedgerAccountType,
} from "@/generated/prisma/client"
import type { LedgerTransactionInput } from "./types"

type Db = Prisma.TransactionClient

// A transaction row with its entries eagerly loaded — the shape the service
// maps into a PostedTransaction.
type TransactionWithEntries = Prisma.LedgerTransactionGetPayload<{
  include: { entries: true }
}>

export class LedgerRepository {
  /** Idempotency lookup — the tx + entries for a key, or null. */
  findTransactionByIdempotencyKey(
    db: Db,
    key: string
  ): Promise<TransactionWithEntries | null> {
    return db.ledgerTransaction.findUnique({
      where: { idempotencyKey: key },
      include: { entries: true },
    })
  }

  /** Bulk-fetch accounts so the service can check existence + read accountType. */
  findAccountsByIds(db: Db, ids: string[]): Promise<LedgerAccount[]> {
    return db.ledgerAccount.findMany({ where: { id: { in: ids } } })
  }

  /**
   * Resolve a single account by tenant + code. findFirst (not findUnique)
   * because tenantId may be null (system accounts) and their global uniqueness
   * is the partial index Prisma doesn't model. Shared by both services.
   */
  findAccount(
    db: Db,
    params: { tenantId: string | null; accountCode: string }
  ): Promise<LedgerAccount | null> {
    return db.ledgerAccount.findFirst({
      where: { tenantId: params.tenantId, accountCode: params.accountCode },
    })
  }

  /**
   * The FOR UPDATE row lock — raw SQL because Prisma has no first-class lock.
   * Columns are case-sensitive in raw SQL, so quote them. Returns a map of
   * accountId -> current balance (Prisma deserializes BIGINT to bigint).
   */
  async lockBalances(
    db: Db,
    accountIds: string[]
  ): Promise<Map<string, bigint>> {
    // Prisma.join([]) is invalid — nothing to lock, return an empty map.
    if (accountIds.length === 0) return new Map()
    const rows = await db.$queryRaw<{ accountId: string; balance: bigint }[]>`
      SELECT "accountId", "balance" FROM "account_balances"
      WHERE "accountId" IN (${Prisma.join(accountIds)})
      FOR UPDATE`
    return new Map(rows.map((r) => [r.accountId, r.balance]))
  }

  /**
   * Create the transaction with its entries in one nested write. Maps the
   * input's `type` onto the `transactionType` column (the one rename).
   */
  insertTransaction(
    db: Db,
    input: LedgerTransactionInput
  ): Promise<TransactionWithEntries> {
    return db.ledgerTransaction.create({
      data: {
        tenantId: input.tenantId,
        transactionType: input.type,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        description: input.description,
        idempotencyKey: input.idempotencyKey,
        entries: {
          create: input.entries.map((e) => ({
            accountId: e.accountId,
            amount: e.amount,
          })),
        },
      },
      include: { entries: true },
    })
  }

  /** Write the balance projection for one account. */
  upsertBalance(
    db: Db,
    accountId: string,
    balance: bigint
  ): Promise<AccountBalance> {
    return db.accountBalance.upsert({
      where: { accountId },
      create: { accountId, balance },
      update: { balance },
    })
  }

  /**
   * Create an account and seed its balance row at 0 (so FOR UPDATE always has a
   * row to lock). Tolerant of the unique constraint: on a concurrent-create
   * race the loser gets P2002 and we return the existing row instead.
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
      return await db.ledgerAccount.create({
        data: {
          tenantId: params.tenantId,
          accountCode: params.accountCode,
          accountType: params.accountType,
          balance: { create: {} },
        },
      })
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
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
  getBalanceRow(db: Db, accountId: string): Promise<AccountBalance | null> {
    return db.accountBalance.findUnique({ where: { accountId } })
  }

  /** Ground truth: SUM(entries.amount) for one account (BalanceService). */
  async sumEntriesForAccount(db: Db, accountId: string): Promise<bigint> {
    const result = await db.ledgerEntry.aggregate({
      where: { accountId },
      _sum: { amount: true },
    })
    return result._sum.amount ?? 0n
  }
}
