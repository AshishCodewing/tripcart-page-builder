import { relations, sql } from "drizzle-orm"
import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { createdAt, uuid } from "./_shared"

export const ledgerAccountType = pgEnum("LedgerAccountType", [
  "SYSTEM",
  "TENANT",
])

export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    tenantId: text("tenantId"),
    accountCode: text("accountCode").notNull(),
    accountType: ledgerAccountType("accountType").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("ledger_accounts_tenantId_idx").on(t.tenantId),
    uniqueIndex("ledger_accounts_tenantId_accountCode_key").on(
      t.tenantId,
      t.accountCode
    ),
    // Partial unique: one SYSTEM account per code (tenantId IS NULL). NULLs are
    // distinct under the composite unique above, so this is added separately.
    uniqueIndex("ledger_accounts_system_code_key")
      .on(t.accountCode)
      .where(sql`${t.tenantId} IS NULL`),
  ]
)

export const ledgerTransactions = pgTable(
  "ledger_transactions",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    tenantId: text("tenantId"),
    transactionType: text("transactionType").notNull(),
    referenceType: text("referenceType"),
    referenceId: text("referenceId"),
    description: text("description"),
    idempotencyKey: text("idempotencyKey").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("ledger_transactions_idempotencyKey_key").on(t.idempotencyKey),
    index("ledger_transactions_tenantId_idx").on(t.tenantId),
    index("ledger_transactions_referenceType_referenceId_idx").on(
      t.referenceType,
      t.referenceId
    ),
  ]
)

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    transactionId: text("transactionId")
      .notNull()
      .references(() => ledgerTransactions.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    accountId: text("accountId")
      .notNull()
      .references(() => ledgerAccounts.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("ledger_entries_accountId_idx").on(t.accountId),
    index("ledger_entries_transactionId_idx").on(t.transactionId),
  ]
)

export const accountBalances = pgTable("account_balances", {
  accountId: text("accountId")
    .primaryKey()
    .references(() => ledgerAccounts.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  balance: bigint("balance", { mode: "bigint" })
    .notNull()
    .default(sql`0`),
  // AccountBalance.updatedAt is @updatedAt with no DB default (like the others).
  updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
})

// ── Relations (for the relational query API / typed includes) ────────────────
export const ledgerAccountsRelations = relations(
  ledgerAccounts,
  ({ many, one }) => ({
    entries: many(ledgerEntries),
    balance: one(accountBalances, {
      fields: [ledgerAccounts.id],
      references: [accountBalances.accountId],
    }),
  })
)

export const ledgerTransactionsRelations = relations(
  ledgerTransactions,
  ({ many }) => ({
    entries: many(ledgerEntries),
  })
)

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  transaction: one(ledgerTransactions, {
    fields: [ledgerEntries.transactionId],
    references: [ledgerTransactions.id],
  }),
  account: one(ledgerAccounts, {
    fields: [ledgerEntries.accountId],
    references: [ledgerAccounts.id],
  }),
}))

export const accountBalancesRelations = relations(
  accountBalances,
  ({ one }) => ({
    account: one(ledgerAccounts, {
      fields: [accountBalances.accountId],
      references: [ledgerAccounts.id],
    }),
  })
)

// Enum union type + a value object mirroring Prisma's generated
// `LedgerAccountType` (both a type and a value, so `LedgerAccountType.TENANT`
// and `: LedgerAccountType` both resolve — declaration merging).
export type LedgerAccountType = (typeof ledgerAccountType.enumValues)[number]
export const LedgerAccountType = {
  SYSTEM: "SYSTEM",
  TENANT: "TENANT",
} as const

export type LedgerAccount = typeof ledgerAccounts.$inferSelect
export type LedgerTransaction = typeof ledgerTransactions.$inferSelect
export type LedgerEntry = typeof ledgerEntries.$inferSelect
export type AccountBalance = typeof accountBalances.$inferSelect
