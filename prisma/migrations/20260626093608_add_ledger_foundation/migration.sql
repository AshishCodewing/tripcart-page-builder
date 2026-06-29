-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('SYSTEM', 'TENANT');

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "accountCode" TEXT NOT NULL,
    "accountType" "LedgerAccountType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "transactionType" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "description" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_balances" (
    "accountId" TEXT NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_balances_pkey" PRIMARY KEY ("accountId")
);

-- CreateIndex
CREATE INDEX "ledger_accounts_tenantId_idx" ON "ledger_accounts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_tenantId_accountCode_key" ON "ledger_accounts"("tenantId", "accountCode");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_idempotencyKey_key" ON "ledger_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ledger_transactions_tenantId_idx" ON "ledger_transactions"("tenantId");

-- CreateIndex
CREATE INDEX "ledger_transactions_referenceType_referenceId_idx" ON "ledger_transactions"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "ledger_entries_accountId_idx" ON "ledger_entries"("accountId");

-- CreateIndex
CREATE INDEX "ledger_entries_transactionId_idx" ON "ledger_entries"("transactionId");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One system account per code (tenantId IS NULL). Postgres treats NULLs as
-- distinct, so the @@unique([tenantId, accountCode]) above does not cover this.
CREATE UNIQUE INDEX "ledger_accounts_system_code_key" ON "ledger_accounts" ("accountCode") WHERE "tenantId" IS NULL;
