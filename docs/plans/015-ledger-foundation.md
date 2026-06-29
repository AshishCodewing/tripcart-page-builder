# Plan 015: Credit ledger foundation

> **Status: NOT STARTED.** Design approved 2026-06-26. Builds the generic,
> business-agnostic ledger core only. Business services (AI Usage, Subscription,
> Credit Purchase, Refund) are explicitly out of scope — they depend on this and
> land in a later plan.
>
> **Read first:** [`docs/reference/ledger.md`](../reference/ledger.md) (the
> mental model + every design decision). This plan is the build order.
>
> Effort: **L**. Depends on: nothing (additive). Touches: `prisma/schema.prisma`
> + one migration; all new code under `lib/ledger/`.

## Context

We're adding a double-entry credit ledger. Everything you need to _understand_
is in the reference doc. This plan tells you, file by file, what to write —
signatures, responsibilities, and the load-bearing algorithms — but leaves the
actual code to you. Where a snippet is shown it's because the detail is easy to
get wrong (raw `FOR UPDATE`, the post-transaction flow), not because you should
paste it verbatim.

**Conventions to honor** (from CLAUDE.md): Prettier — no semicolons, double
quotes, 2-space indent, `printWidth: 80`. Strict TypeScript, no `any`. Import
the Prisma client from `@/generated/prisma/client` (**not** `@prisma/client`).
Tests are Vitest (`*.test.ts` under `lib/`), `pnpm test`.

## Build order (overview)

```
1. Schema + migration         prisma/schema.prisma  (+ partial-index SQL)
2. types.ts                   ← no deps
3. errors.ts                  ← no deps
4. ledger.math.ts             ← types        (pure: sum, deltas)
5. ledger.validator.ts        ← types, errors, math
6. transaction.factory.ts     ← types        (pure builders)
7. ledger.repository.ts       ← Prisma        (persistence + FOR UPDATE)
8. balance.service.ts         ← repository
9. account.service.ts         ← repository
10. ledger.service.ts         ← all of the above (orchestrator)
11. index.ts                  ← composition root
12. tests                     ← factory, validator, math (pure, no DB)
13. verify                    ← typecheck, test, lint
```

Steps 2–6 and 12 are **pure** (no DB) — do those first and you can unit-test
immediately. Steps 7–11 touch Prisma and need the migration applied.

---

## Step 1 — Schema + migration

Add four models + one enum to `prisma/schema.prisma`. Place them in a clearly
commented `// ── Credit Ledger ──` section (e.g. just before `model DocChunk`).

```prisma
enum LedgerAccountType {
  SYSTEM   // platform-owned, tenantId = null
  TENANT   // one TENANT_WALLET per tenant
}

model LedgerAccount {
  id          String            @id @default(uuid())
  tenantId    String?           // null = system account
  accountCode String
  accountType LedgerAccountType
  createdAt   DateTime          @default(now())

  entries LedgerEntry[]
  balance AccountBalance?

  // Per-tenant uniqueness. Global (tenantId NULL) dedupe is a PARTIAL unique
  // index added in the migration SQL — see below. Same trick as Template.
  @@unique([tenantId, accountCode])
  @@index([tenantId])
  @@map("ledger_accounts")
}

model LedgerTransaction {
  id              String   @id @default(uuid())
  tenantId        String?
  transactionType String
  referenceType   String?
  referenceId     String?
  description     String?
  idempotencyKey  String   @unique
  createdAt       DateTime @default(now())

  entries LedgerEntry[]

  @@index([tenantId])
  @@index([referenceType, referenceId])
  @@map("ledger_transactions")
}

model LedgerEntry {
  id            String            @id @default(uuid())
  transactionId String
  transaction   LedgerTransaction @relation(fields: [transactionId], references: [id])
  accountId     String
  account       LedgerAccount     @relation(fields: [accountId], references: [id])
  amount        BigInt            // signed units; + increases, - decreases
  createdAt     DateTime          @default(now())

  @@index([accountId])
  @@index([transactionId])
  @@map("ledger_entries")
}

model AccountBalance {
  accountId String        @id
  account   LedgerAccount @relation(fields: [accountId], references: [id])
  balance   BigInt        @default(0)
  updatedAt DateTime      @updatedAt

  @@map("account_balances")
}
```

**Why no FK from `tenantId` to `Tenant`:** keeps the ledger decoupled and, more
importantly, prevents a tenant delete from ever cascading into ledger history
(the ledger is append-only forever). It's a plain indexed string.

### Migration (two-step, because of the partial index)

Prisma can't emit the `WHERE tenantId IS NULL` partial index, so generate the
migration **without applying**, hand-edit the SQL, then apply:

```bash
pnpm prisma migrate dev --create-only --name add_ledger_foundation
```

Open the generated `prisma/migrations/<ts>_add_ledger_foundation/migration.sql`
and append the partial unique index:

```sql
-- One system account per code (tenantId IS NULL). Postgres treats NULLs as
-- distinct, so the @@unique([tenantId, accountCode]) above does not cover this.
CREATE UNIQUE INDEX "ledger_accounts_system_code_key"
  ON "ledger_accounts" ("accountCode")
  WHERE "tenantId" IS NULL;
```

Then apply + regenerate the client:

```bash
pnpm prisma migrate dev          # applies, runs generate
```

**Verify** the client picked up the models: `pnpm typecheck` should now see
`prisma.ledgerAccount`, `prisma.ledgerTransaction`, etc.

> STOP if the migration won't apply (DB unreachable). The rest of the steps that
> touch Prisma can't typecheck until the client is regenerated.

---

## Step 2 — `lib/ledger/types.ts`

Pure types + constants. No imports from Prisma.

- **Account-code constants**: a `const` object/enum for the system codes
  (`CREDIT_ISSUANCE`, `AI_CONSUMED`, `CREDIT_EXPIRED`, `ADJUSTMENT`) and
  `TENANT_WALLET`. Export a union type `AccountCode`.
- **Unit scale**: `export const UNITS_PER_CREDIT = 1000n` and a helper
  `creditsToUnits(credits: bigint): bigint` (guard: integer, `> 0` where the
  caller expects a positive amount). Keep conversion at the edges only.
- **Transaction-type constants**: `AI_USAGE`, `SUBSCRIPTION_GRANT`,
  `CREDIT_PURCHASE`, `REFUND`, `EXPIRATION`, `MANUAL_ADJUSTMENT`, `TRANSFER`.
- **Input shapes** the service accepts (note `type`, not `transactionType` — the
  repository maps it):

```ts
export interface LedgerEntryInput {
  accountId: string
  amount: bigint // signed units
}

export interface LedgerTransactionInput {
  tenantId: string
  type: string
  referenceType?: string
  referenceId?: string
  description?: string
  idempotencyKey: string
  entries: LedgerEntryInput[]
}
```

- **Result shape** `PostedTransaction` (id, type, entries with resolved ids,
  createdAt) returned by `postTransaction`.

---

## Step 3 — `lib/ledger/errors.ts`

A `LedgerError` base (set `this.name` from the subclass) and the five subclasses
listed in the reference doc's Errors section. Plain `Error` subclasses; give each
a sensible default message and let callers pass detail.

---

## Step 4 — `lib/ledger/ledger.math.ts`

Pure functions, the unit-testable heart of "balance calculations":

- `sumEntries(entries: LedgerEntryInput[]): bigint` — reduce over `amount`.
- `computeDeltas(entries): Map<string, bigint>` — net change per `accountId`
  (an account can appear twice; sum them). The service uses this to know which
  balance rows to touch and by how much.

Keeping these here (not inline in the service) is what lets you test balance math
with no database.

---

## Step 5 — `lib/ledger/ledger.validator.ts`

A `LedgerValidator` class with `validate(input: LedgerTransactionInput): void`
that throws on the first failure. Pure — no DB. Rules:

1. `tenantId`, `idempotencyKey`, `type` present → else `LedgerValidationError`.
2. `entries.length >= 2` → else `LedgerValidationError`.
3. each entry: `accountId` present, `amount` is a `bigint`, `amount !== 0n` →
   else `LedgerValidationError`.
4. `sumEntries(entries) === 0n` → else `LedgerBalanceError`.

Account existence (Rule 3 in the PDF) and the negative-wallet rule are **not**
here — they need the DB and live in the service inside the transaction.

---

## Step 6 — `lib/ledger/transaction.factory.ts`

`LedgerFactory` — an object of **pure** builder functions, one per transaction
type, each returning a `LedgerTransactionInput`. They take already-resolved
account ids (the caller resolves codes → ids via `AccountService`) plus a credit
amount and reference, and they own the **sign convention** so business code
can't get it wrong. Example:

```ts
export const LedgerFactory = {
  createAIUsage(p: {
    tenantId: string
    walletAccountId: string
    aiConsumedAccountId: string
    credits: bigint // positive, in credits
    usageId: string
    idempotencyKey: string
    description?: string
  }): LedgerTransactionInput {
    const amount = creditsToUnits(p.credits) // throws if <= 0
    return {
      tenantId: p.tenantId,
      type: TRANSACTION_TYPES.AI_USAGE,
      referenceType: "AI_USAGE",
      referenceId: p.usageId,
      idempotencyKey: p.idempotencyKey,
      description: p.description,
      entries: [
        { accountId: p.walletAccountId, amount: -amount },
        { accountId: p.aiConsumedAccountId, amount: amount },
      ],
    }
  },
  // createSubscriptionGrant, createCreditPurchase, createRefund,
  // createExpiration, createManualAdjustment (grant + remove), createTransfer
}
```

Match the entry shapes in the reference doc's transaction-types table. All take
**positive** credits and negate the correct side internally.

---

## Step 7 — `lib/ledger/ledger.repository.ts`

The only file that talks to Prisma tables. **No business logic, no validation**
(PDF: repository responsibilities). Every method takes a transaction client so
it can run inside `postTransaction`'s atomic block:

```ts
import { Prisma } from "@/generated/prisma/client"
type Db = Prisma.TransactionClient // also accepts the full PrismaClient
```

Methods:

- `findTransactionByIdempotencyKey(db, key)` → transaction + entries or `null`.
- `findAccountsByIds(db, ids: string[])` → `LedgerAccount[]`.
- `lockBalances(db, accountIds): Promise<Map<string, bigint>>` — **the
  `FOR UPDATE`**. Raw query, returns `bigint` balances:

  ```ts
  const rows = await db.$queryRaw<{ accountId: string; balance: bigint }[]>`
    SELECT "accountId", "balance" FROM "account_balances"
    WHERE "accountId" IN (${Prisma.join(accountIds)})
    FOR UPDATE`
  return new Map(rows.map((r) => [r.accountId, r.balance]))
  ```

  (Guard the empty-array case — `Prisma.join([])` is invalid.)
- `insertTransaction(db, input)` → create the `LedgerTransaction` with nested
  `entries` create; return it with entries included.
- `upsertBalance(db, accountId, balance: bigint)` → upsert `account_balances`.
- `createAccount(db, { tenantId, accountCode, accountType })` → create the
  account **and** its `AccountBalance` row at `0` (so `FOR UPDATE` always has a
  row to lock). Make it tolerant of the unique constraint (already exists → fetch).
- `getBalanceRow(db, accountId)` and `sumEntriesForAccount(db, accountId)` →
  used by `BalanceService.verify`/`rebuild`.

> Columns are camelCase and case-sensitive in raw SQL — quote them
> (`"accountId"`), and the table is `account_balances` (snake, via `@@map`).

---

## Step 8 — `lib/ledger/balance.service.ts`

Fast-read + integrity API. Constructor takes the Prisma client + repository.

- `getBalance(accountId): Promise<bigint>` — read the projection.
- `getWalletBalance(tenantId): Promise<bigint>` — resolve the tenant wallet
  (via `AccountService`, or accept the id) then read it.
- `rebuild(accountId)` — recompute from `SUM(entries.amount)` and write the
  projection (recovery / migration tool).
- `verify(accountId): Promise<boolean>` — projection === sum of entries.

These run **outside** the post transaction (plain reads), so they take the full
client, not a `tx`.

---

## Step 9 — `lib/ledger/account.service.ts`

Account discovery/creation (PDF: "resolve system accounts", "create tenant
wallets"). Constructor takes Prisma + repository.

- `ensureSystemAccounts()` — idempotently create the four SYSTEM accounts if
  missing. Safe to call on boot/seed.
- `getSystemAccountId(code)` — resolve a system code → id; throw
  `AccountNotFoundError` if absent.
- `ensureTenantWallet(tenantId)` — create the wallet (+ zero balance row) if
  missing; return it.
- `getTenantWalletId(tenantId)` — resolve; throw if absent.

Creation goes through `repository.createAccount` so the balance row is seeded.

---

## Step 10 — `lib/ledger/ledger.service.ts`

The orchestrator and the **single write entry point**. Constructor:
`(prisma, repository, validator)`. One public method:

```ts
async postTransaction(input: LedgerTransactionInput): Promise<PostedTransaction>
```

Algorithm (the load-bearing part — get the ordering right):

```
1. validator.validate(input)                       // pure checks, before any DB
2. return prisma.$transaction(async (tx) => {
     a. existing = repo.findTransactionByIdempotencyKey(tx, input.idempotencyKey)
        if (existing) return toPosted(existing)     // idempotent replay
     b. ids = unique(entries.map(e => e.accountId))
        accounts = repo.findAccountsByIds(tx, ids)
        if (accounts.length !== ids.length) throw AccountNotFoundError
     c. locked = repo.lockBalances(tx, ids)         // FOR UPDATE — blocks racers
     d. deltas = computeDeltas(entries)
        for ([accountId, delta] of deltas):
          next = (locked.get(accountId) ?? 0n) + delta
          if (account.accountType === "TENANT" && next < 0n)
            throw InsufficientCreditsError
     e. created = repo.insertTransaction(tx, input)
     f. for ([accountId, delta] of deltas):
          repo.upsertBalance(tx, accountId, (locked.get(accountId) ?? 0n) + delta)
     g. return toPosted(created)
   }).catch(rethrowP2002AsDuplicate)               // concurrent unique race
}
```

Notes:
- Default isolation (Read Committed) is correct **because** of the `FOR UPDATE`
  row locks — don't reach for Serializable.
- Negative guard is **TENANT-only** (system accounts go negative by design).
- `rethrowP2002AsDuplicate`: if the error is Prisma `P2002` on `idempotencyKey`,
  throw `DuplicateTransactionError` (the racing twin lost). Everything else
  rethrows untouched.

---

## Step 11 — `lib/ledger/index.ts`

Composition root — wire the pieces (composition, not inheritance):

```ts
export function createLedger(client: PrismaClient = prisma) {
  const repository = new LedgerRepository()
  const validator = new LedgerValidator()
  const accounts = new AccountService(client, repository)
  const balances = new BalanceService(client, repository)
  const ledger = new LedgerService(client, repository, validator)
  return { ledger, accounts, balances }
}
```

Re-export the public surface: `types`, `errors`, `LedgerFactory`. Optionally
export a default instance bound to the app `prisma` for convenience. Business
code should only ever import from `@/lib/ledger` — never reach into the
repository or `prisma.ledgerEntry` directly.

---

## Step 12 — Tests (pure, no DB)

Vitest, under `lib/ledger/`, `*.test.ts`. Target the PDF's unit-test list:
factories, validators, balance calculations.

- **`ledger.math.test.ts`** — `sumEntries` of balanced/unbalanced sets;
  `computeDeltas` nets a repeated account correctly.
- **`ledger.validator.test.ts`** — passes a valid 2-entry balanced tx; throws
  `LedgerBalanceError` when sum ≠ 0; `LedgerValidationError` for `< 2` entries,
  zero amount, missing key/tenant/type.
- **`transaction.factory.test.ts`** — each factory: entries sum to zero, signs
  land on the right accounts, credits→units conversion (`25` → `25_000n`),
  rejects `credits <= 0`.

**Invariant test** (PDF "Invariant Tests"): a parametrized test asserting every
factory output satisfies `sumEntries(...) === 0n`. This is the always-true law.

DB-backed behavior (concurrency, idempotency replay, negative guard) needs a
Postgres test database we don't have configured yet — note it as a **follow-up**
(integration tests) rather than blocking the foundation. If you want them now,
they'd use a disposable Postgres + the real `postTransaction`.

---

## Step 13 — Verify

```bash
pnpm typecheck   # client sees the new models; lib/ledger types resolve
pnpm test        # the pure tests pass
pnpm lint
pnpm format      # don't hand-format
```

## Acceptance checklist

- [ ] 4 models + enum in schema; migration applied; partial system-code index present.
- [ ] `prisma.ledgerAccount` etc. available (client regenerated).
- [ ] `lib/ledger/` files from steps 2–11 exist, each with its single responsibility.
- [ ] `LedgerService.postTransaction` is the only writer; business code can't reach entries.
- [ ] Validator + factories + math unit-tested; invariant test green.
- [ ] `bigint` end-to-end; no floats; `1 credit = 1000 units`.
- [ ] Idempotent replay returns existing tx; `DuplicateTransactionError` only on race.
- [ ] Negative guard fires for `TENANT_WALLET` only.
- [ ] `pnpm typecheck && pnpm test && pnpm lint` clean.

## STOP conditions

- Don't build any business service (AI Usage, Subscription, Purchase, Refund),
  the `ai_usage` table, or subscription/plan tables — out of scope.
- Don't add a `tenantId → Tenant` FK or any cascade onto ledger tables.
- Don't store balances as a primary value anywhere outside `account_balances`.
- If the negative-balance or idempotency semantics feel wrong for a real caller,
  revisit the reference doc's decisions log before changing them here.

## Follow-ups (next plans, not this one)

1. Integration tests against a disposable Postgres: concurrency (double-spend
   race), idempotent replay, negative guard.
2. Business services that build transactions via `LedgerFactory` and post them.
3. `ai_usage`, `subscription_plans`, `tenant_subscriptions` tables + reporting
   (wallet balance, consumption, profitability).
4. `credit_buckets` layer for differential expiration (FIFO / expiring-first).
```
