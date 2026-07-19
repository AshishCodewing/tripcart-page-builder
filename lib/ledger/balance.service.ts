/**
 * Fast-read + integrity API over the balance projection. Reads trust the
 * cached `account_balances` row; verify/rebuild reconcile it against the
 * ground-truth SUM(entries.amount). Every method is a plain read outside any
 * transaction, so it uses the full client (no locking needed).
 */
import type { Database } from "@/lib/db"
import { AccountNotFoundError } from "./errors"
import type { LedgerRepository } from "./ledger.repository"
import { ACCOUNT_CODES } from "./types"

export class BalanceService {
  constructor(
    private readonly db: Database,
    private readonly repository: LedgerRepository
  ) {}

  /** Read the projection. Missing row -> 0n (the account simply hasn't moved). */
  async getBalance(accountId: string): Promise<bigint> {
    const row = await this.repository.getBalanceRow(this.db, accountId)
    return row?.balance ?? 0n
  }

  /** Resolve a tenant's wallet, then read its balance. */
  async getWalletBalance(tenantId: string): Promise<bigint> {
    const wallet = await this.repository.findAccount(this.db, {
      tenantId,
      accountCode: ACCOUNT_CODES.TENANT_WALLET,
    })
    if (!wallet) {
      throw new AccountNotFoundError(`no wallet for tenant ${tenantId}`)
    }
    return this.getBalance(wallet.id)
  }

  /**
   * Recompute the projection from entries and overwrite it. Recovery/migration
   * tool — the projection should never drift, but this repairs it if it does.
   * Returns the rebuilt balance.
   */
  async rebuild(accountId: string): Promise<bigint> {
    const sum = await this.repository.sumEntriesForAccount(this.db, accountId)
    await this.repository.upsertBalance(this.db, accountId, sum)
    return sum
  }

  /** True if the projection equals the sum of entries (integrity check). */
  async verify(accountId: string): Promise<boolean> {
    const [projection, truth] = await Promise.all([
      this.getBalance(accountId),
      this.repository.sumEntriesForAccount(this.db, accountId),
    ])
    return projection === truth
  }
}
