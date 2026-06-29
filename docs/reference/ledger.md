# Credit Ledger — Design Reference

> Mental model + design decisions for the AI credit wallet ledger. This is the
> "why" doc. The "how to build it" lives in
> [`docs/plans/015-ledger-foundation.md`](../plans/015-ledger-foundation.md).
>
> Source specs (the three PDFs): _AI Credit Wallet Ledger System Design_,
> _Ledger Service Architecture Design_, _AI Copilot User Story_. This doc
> reconciles them with the repo's actual conventions (Prisma 7, `lib/`, Vitest).

## What the ledger is

The platform gives tenants AI features paid for with **credits**. Tenants get
credits from subscription grants or purchases and spend them on AI usage. The
ledger is the **single source of truth** for every credit movement — a generic,
double-entry accounting core that knows nothing about Stripe, OpenAI, or
subscription plans.

**Scope of this foundation:** the generic ledger only — accounts, transactions,
entries, balance projections, and the service that posts transactions safely.
The business services that _build_ transactions (AI Usage, Subscription, Credit
Purchase, Refund) are **out of scope** and come later — they sit _on top_ of
this and depend on it, never the reverse.

```
AI Usage Service ─┐
Subscription Svc ─┼──▶  Ledger Service   (this foundation)
Credit Purchase ─┤        ├─ Validator
Refund Service  ─┘        ├─ Repository
                          ├─ Balance Service
                          ├─ Account Service
                          └─ Transaction Factory
```

The arrows only point **down**. The ledger never imports a business service.

## The ten invariants (must always hold)

1. The ledger is **immutable** — entries are never `UPDATE`d or `DELETE`d.
2. Every transaction **balances to zero**: `SUM(entries.amount) = 0`.
3. Wallet balances are **projections** derived from entries, never a primary store.
4. Credits are **integer units only** — no floating point.
5. All transactions are **idempotent** (unique `idempotencyKey`).
6. **No direct balance updates** from business code — only `LedgerService` writes.
7. Every AI charge references a usage record; every purchase a payment; every
   grant a billing cycle. (Enforced by the _callers_; the ledger just stores
   `referenceType`/`referenceId`.)
8. The ledger can be **fully reconstructed** from entries alone.

Corrections are never edits — they are **new, reversing transactions**.

## Double-entry, in one example

Every business event becomes a transaction whose entries sum to zero. Positive
increases an account, negative decreases it.

```
AI usage (spend 25 credits):
  TENANT_WALLET   -25      ← wallet goes down
  AI_CONSUMED     +25      ← consumption account goes up
                  ───
                    0      ✅ balances
```

The wallet balance is just `SUM(amount)` over all entries touching that wallet.

## Chart of accounts

Small and fixed. **System accounts** are platform-owned (`tenantId = null`);
there is exactly **one of each** across the whole platform. **Tenant accounts**
are one wallet per tenant.

| Code               | Type   | tenantId | Meaning                                   |
|--------------------|--------|----------|-------------------------------------------|
| `CREDIT_ISSUANCE`  | SYSTEM | null     | Credits issued into circulation (grants, purchases, promos) |
| `AI_CONSUMED`      | SYSTEM | null     | Credits consumed by AI operations         |
| `CREDIT_EXPIRED`   | SYSTEM | null     | Credits removed by expiration             |
| `ADJUSTMENT`       | SYSTEM | null     | Manual admin grants/removals              |
| `TENANT_WALLET`    | TENANT | <tenant> | A tenant's spendable balance              |

**Sign intuition:** issuance/consumption/expired/adjustment accounts are
"sources and sinks" — they freely go negative or positive. Only **`TENANT_WALLET`
is constrained `>= 0`** (a tenant can't spend what they don't have). This is the
single most important asymmetry in the whole system.

### The credit unit scale

`1 credit = 1000 units`. We store **units** (an integer) in a `BIGINT` column,
mapped to TypeScript `bigint`. So "25 credits" is `25_000n` units. This avoids
floating point entirely (invariant 4) and leaves room for sub-credit pricing
later. Define `UNITS_PER_CREDIT = 1000n` and convert at the edges only.

> Decision: use `bigint` end-to-end, not `number`. `BIGINT` columns map to
> `bigint` in Prisma, raw `FOR UPDATE` reads return `bigint`, and it removes any
> `Number.MAX_SAFE_INTEGER` worry. The minor ergonomic cost (`25_000n`,
> `JSON` can't serialize `bigint` without a replacer) is worth the correctness.

## Data model (4 tables)

All four are new Prisma models. We follow **repo conventions, not the PDF's raw
SQL**: camelCase Prisma fields → camelCase Postgres columns (the existing models
do this — only the _table_ name is `@@map`ped to snake_case), `String` ids with
`@default(uuid())`, and `BigInt` for money.

| Model (table)                          | Purpose                                  |
|----------------------------------------|------------------------------------------|
| `LedgerAccount` (`ledger_accounts`)    | Chart of accounts (system + tenant wallets) |
| `LedgerTransaction` (`ledger_transactions`) | One business event; groups entries  |
| `LedgerEntry` (`ledger_entries`)       | Signed amount against one account (immutable) |
| `AccountBalance` (`account_balances`)  | Fast-read projection of one account's balance |

Field-level shapes and the full Prisma block are in the plan
([`015` → Step 1](../plans/015-ledger-foundation.md#step-1-schema--migration)).

### The system-account uniqueness problem

We want **one** `CREDIT_ISSUANCE` row globally, but **one** `TENANT_WALLET` _per
tenant_. A plain `@@unique([tenantId, accountCode])` enforces the per-tenant
rule but **not** the global one — Postgres treats `NULL` tenantIds as distinct,
so it would happily allow two `CREDIT_ISSUANCE` rows.

This is the **exact** problem the `Template` model already solved (see its
schema comment): keep the composite `@@unique` for tenant rows, and add a
**partial unique index** in the migration SQL for the global rows:

```sql
CREATE UNIQUE INDEX "ledger_accounts_system_code_key"
  ON "ledger_accounts" ("accountCode")
  WHERE "tenantId" IS NULL;
```

Prisma 7's `@@unique` can't express the `WHERE`, so it's hand-added to the
generated migration — same as Template's `(slug) WHERE tenantId IS NULL`.

## Supported transaction types (entry shapes)

The ledger itself is generic — it just stores a `transactionType` string. These
are the shapes the (future) business services and the factories produce. Amounts
shown in **credits**; the factory multiplies by `UNITS_PER_CREDIT`.

| Type                | Entries (credits)                          | Reference        |
|---------------------|--------------------------------------------|------------------|
| `SUBSCRIPTION_GRANT`| `CREDIT_ISSUANCE -N`, `TENANT_WALLET +N`   | billing cycle id |
| `CREDIT_PURCHASE`   | `CREDIT_ISSUANCE -N`, `TENANT_WALLET +N`   | Stripe payment id|
| `AI_USAGE`          | `TENANT_WALLET -N`, `AI_CONSUMED +N`       | usage id         |
| `REFUND`            | `AI_CONSUMED -N`, `TENANT_WALLET +N`       | usage/refund id  |
| `EXPIRATION`        | `TENANT_WALLET -N`, `CREDIT_EXPIRED +N`    | —                |
| `MANUAL_ADJUSTMENT` | grant: `ADJUSTMENT -N`, `TENANT_WALLET +N` / remove: reverse | admin id |
| `TRANSFER` (opt.)   | `TENANT_WALLET(A) -N`, `TENANT_WALLET(B) +N` | —              |

Each is a one-line `LedgerFactory.createX(...)` returning a transaction _input_
object (pure, no DB) — see [plan Step 4](../plans/015-ledger-foundation.md#step-4-transaction-factory).

## Concurrency: the double-spend race

Tenant has 10 credits. Two AI requests costing 10 each arrive at the same
instant. Without locking, both read "10 ≥ 10 ✅", both post, balance lands at
**-10**. The fix: inside the DB transaction, **lock the wallet's balance row**
before reading it, so the second request waits for the first to commit.

```sql
SELECT "balance" FROM "account_balances"
  WHERE "accountId" = $1
  FOR UPDATE;          -- must be inside a DB transaction
```

Prisma has no first-class `FOR UPDATE`, so we use `tx.$queryRaw` _inside_ an
interactive `prisma.$transaction(async (tx) => …)`. The lock + the balance read
+ the negative-balance check + the inserts + the projection update all happen on
the same connection, in one atomic transaction. See
[plan Step 7](../plans/015-ledger-foundation.md#step-7-ledger-service-orchestrator).

## Idempotency strategy

Every transaction carries an `idempotencyKey` (e.g. `usage_request_123`), unique
in the DB. This makes retries safe — a network blip that causes the caller to
re-submit must not double-charge.

> Decision: on a **repeated key, return the existing transaction** (a no-op
> replay) rather than throwing. The PDF's error list names a
> `DuplicateTransactionError`; we reserve that for the genuine **concurrent
> race** — two posts with the same key that both pass the pre-check and collide
> on the unique constraint (`P2002`). The common retry case (key already
> committed) returns the original result, which is what "safe retries" means.

## Errors

Typed errors, all extending a `LedgerError` base, so callers can branch:

- `LedgerValidationError` — missing key/tenant/type, `< 2` entries, zero amount.
- `LedgerBalanceError` — entries don't sum to zero.
- `InsufficientCreditsError` — a `TENANT_WALLET` would go negative.
- `DuplicateTransactionError` — concurrent unique-key collision.
- `AccountNotFoundError` — an entry references a non-existent account.

## Decisions log

| Decision | Choice | Why |
|---|---|---|
| Location | `lib/ledger/` | Repo uses `lib/`, not the PDF's `src/services/`. The empty `lib/ledger/` dir already exists. |
| Column case | camelCase columns, snake_case tables | Matches every existing model (only `@@map` the table). |
| PK | `String @default(uuid())` | Auditable convention; existing models use cuid but uuid is fine and matches the PDF intent. Stored as text like the rest. |
| Money | `BigInt` / `bigint`, units (1 credit = 1000) | Invariant 4 (no floats); headroom for sub-credit pricing. |
| Tenant link | plain `tenantId String?`, **no FK relation** | Keeps the ledger decoupled + append-only safe (a tenant delete must never cascade-delete ledger history). |
| Negative guard | only `TENANT` accounts | System source/sink accounts are _meant_ to go negative/positive. |
| Idempotent replay | return existing tx; `DuplicateTransactionError` only on race | That's what "safe retries" requires. |
| Composition | small services wired in `index.ts` | PDF's explicit "composition over inheritance" — no `abstract class LedgerTransaction`. |

## Out of scope (future, no ledger redesign needed)

- **Business services**: AI Usage, Subscription, Credit Purchase, Refund — they
  build transactions and call `postTransaction`. Tracked separately.
- **`ai_usage` table** (provider/model/tokens/cost/credits_charged), **subscription
  plans**, **tenant subscriptions** — business-layer, not ledger.
- **`credit_buckets`** — for differential expiration (FIFO / expiring-first).
  The ledger stays unchanged; a bucket layer sits beside it later.
- Credit expiration buckets, promo/referral credits, department budgets,
  parent/child accounts, multi-currency. All additive.
```
