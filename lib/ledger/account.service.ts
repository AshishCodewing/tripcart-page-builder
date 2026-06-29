/**
 * Chart-of-accounts lifecycle: discovery + creation. Two contracts —
 * `ensure*` is idempotent (create-if-missing, safe on every boot/seed),
 * `get*` is strict (resolve-or-throw). All creation routes through
 * `repository.createAccount`, which seeds the balance row at 0 so the
 * orchestrator's FOR UPDATE always has a row to lock.
 */
import { LedgerAccountType } from "@/generated/prisma/client"
import type { LedgerAccount, PrismaClient } from "@/generated/prisma/client"
import { AccountNotFoundError } from "./errors"
import type { LedgerRepository } from "./ledger.repository"
import { ACCOUNT_CODES, SYSTEM_ACCOUNT_CODES } from "./types"
import type { SystemAccountCode } from "./types"

export class AccountService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly repository: LedgerRepository
  ) {}

  /** Idempotently create the four SYSTEM accounts. Safe to call on boot/seed. */
  async ensureSystemAccounts(): Promise<void> {
    await Promise.all(
      SYSTEM_ACCOUNT_CODES.map((accountCode) =>
        this.repository.createAccount(this.prisma, {
          tenantId: null,
          accountCode,
          accountType: LedgerAccountType.SYSTEM,
        })
      )
    )
  }

  /** Resolve a system code -> id. Throws if the account is missing. */
  async getSystemAccountId(code: SystemAccountCode): Promise<string> {
    const account = await this.repository.findAccount(this.prisma, {
      tenantId: null,
      accountCode: code,
    })
    if (!account) {
      throw new AccountNotFoundError(`system account ${code} not found`)
    }
    return account.id
  }

  /** Create the tenant wallet (+ seeded balance row) if missing; return it. */
  async ensureTenantWallet(tenantId: string): Promise<LedgerAccount> {
    const existing = await this.repository.findAccount(this.prisma, {
      tenantId,
      accountCode: ACCOUNT_CODES.TENANT_WALLET,
    })
    if (existing) return existing
    return this.repository.createAccount(this.prisma, {
      tenantId,
      accountCode: ACCOUNT_CODES.TENANT_WALLET,
      accountType: LedgerAccountType.TENANT,
    })
  }

  /** Resolve a tenant's wallet -> id. Throws if missing. */
  async getTenantWalletId(tenantId: string): Promise<string> {
    const wallet = await this.repository.findAccount(this.prisma, {
      tenantId,
      accountCode: ACCOUNT_CODES.TENANT_WALLET,
    })
    if (!wallet) {
      throw new AccountNotFoundError(`no wallet for tenant ${tenantId}`)
    }
    return wallet.id
  }
}
