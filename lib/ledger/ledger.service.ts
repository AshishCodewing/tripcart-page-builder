/**
 * The orchestrator and the SINGLE write entry point for the ledger. Business
 * code builds a LedgerTransactionInput (via LedgerFactory) and posts it here;
 * nothing else mutates ledger tables. postTransaction enforces, in order:
 * pure validation -> idempotent replay -> account existence -> FOR UPDATE lock
 * -> TENANT-only negative guard -> insert + projection update, all atomic.
 */
import { LedgerAccountType, Prisma } from "@/generated/prisma/client"
import type { PrismaClient } from "@/generated/prisma/client"
import {
  AccountNotFoundError,
  DuplicateTransactionError,
  InsufficientCreditsError,
} from "./errors"
import { computeDeltas } from "./ledger.math"
import type { LedgerRepository } from "./ledger.repository"
import type { LedgerValidator } from "./ledger.validator"
import type { LedgerTransactionInput, PostedTransaction } from "./types"

type TransactionWithEntries = Prisma.LedgerTransactionGetPayload<{
  include: { entries: true }
}>

export class LedgerService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly repository: LedgerRepository,
    private readonly validator: LedgerValidator
  ) {}

  async postTransaction(
    input: LedgerTransactionInput
  ): Promise<PostedTransaction> {
    // Pure checks first — fail before acquiring any lock.
    this.validator.validate(input)

    try {
      return await this.prisma.$transaction(async (tx) => {
        // (a) Idempotent replay: a committed key returns its original result.
        const existing = await this.repository.findTransactionByIdempotencyKey(
          tx,
          input.idempotencyKey
        )
        if (existing) return this.toPosted(existing)

        // (b) Account existence (needs the DB, so not in the validator).
        const ids = [...new Set(input.entries.map((e) => e.accountId))]
        const accounts = await this.repository.findAccountsByIds(tx, ids)
        if (accounts.length !== ids.length) {
          throw new AccountNotFoundError("one or more accounts do not exist")
        }
        const accountsById = new Map(accounts.map((a) => [a.id, a]))

        // (c) Lock the balance rows — blocks concurrent writers (FOR UPDATE).
        const locked = await this.repository.lockBalances(tx, ids)

        // (d) Negative guard, TENANT-only. Compute next balances once, reuse in (f).
        const deltas = computeDeltas(input.entries)
        const nextBalances = new Map<string, bigint>()
        for (const [accountId, delta] of deltas) {
          const account = accountsById.get(accountId)
          if (!account) {
            throw new AccountNotFoundError(accountId)
          }
          const next = (locked.get(accountId) ?? 0n) + delta
          if (account.accountType === LedgerAccountType.TENANT && next < 0n) {
            throw new InsufficientCreditsError(
              `wallet ${accountId} would go to ${next}`
            )
          }
          nextBalances.set(accountId, next)
        }

        // (e) Insert the transaction + entries.
        const created = await this.repository.insertTransaction(tx, input)

        // (f) Update the projection. Sequential: one tx connection, no parallel.
        for (const [accountId, next] of nextBalances) {
          await this.repository.upsertBalance(tx, accountId, next)
        }

        return this.toPosted(created)
      })
    } catch (error) {
      // (g) A racing twin with the same NEW key collided on the unique insert.
      this.rethrowP2002AsDuplicate(error)
    }
  }

  /** Map a persisted transaction row to the public result shape. */
  private toPosted(tx: TransactionWithEntries): PostedTransaction {
    return {
      id: tx.id,
      type: tx.transactionType,
      entries: tx.entries.map((e) => ({
        id: e.id,
        accountId: e.accountId,
        amount: e.amount,
      })),
      createdAt: tx.createdAt,
    }
  }

  /**
   * P2002 here can only be the idempotencyKey unique constraint (the only
   * unique write inside postTransaction) — the genuine concurrent race. Map it
   * to DuplicateTransactionError; rethrow everything else untouched.
   */
  private rethrowP2002AsDuplicate(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DuplicateTransactionError()
    }
    throw error
  }
}
