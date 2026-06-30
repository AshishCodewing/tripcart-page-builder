# Ledger Service — Technical Design Document (TDD)

| | |
|---|---|
| **Component** | AI Credit Wallet — Ledger Service |
| **Status** | Draft v1.0 |
| **Owner** | _TBD_ |
| **Last updated** | 2026-06-30 |
| **Related docs** | `ledger-service-prd.md` (requirements, LR-IDs), `ai-copilot-tdd.md` |

---

## 1. Overview

The Ledger Service is a generic, double-entry accounting core for a multi-tenant credit wallet. It exposes a single write method (`postTransaction`) that validates, locks, persists, and projects balanced transactions. It is built from small composed services and knows nothing about Stripe, AI providers, or subscription plans.

## 2. Architectural principles

1. **Composition over inheritance.**
2. **The ledger service is generic.**
3. **Business services create transactions** (via factories).
4. **The ledger service persists transactions.**
5. **Factories generate transaction structures.**
6. **Validators enforce invariants.**
7. **Repositories handle persistence.**
8. **Balance projections provide fast reads.**
9. **Database transactions guarantee consistency.**
10. **Idempotency prevents duplicate charges.**

### Why composition (not inheritance)
**Do not build:**
```ts
abstract class LedgerTransaction {}
class AIUsageTransaction extends LedgerTransaction {}
class RefundTransaction extends LedgerTransaction {}
class CreditPurchaseTransaction extends LedgerTransaction {}
```
Inheritance trees become hard to maintain, different transaction types have different validation needs, shared base classes accumulate unrelated responsibilities, and business rules get coupled to ledger internals. (This decision warrants a standalone ADR — see §13.)

## 3. System architecture & dependency direction

```
Application
├── AI Usage Service
├── Subscription Service
├── Credit Purchase Service
├── Refund Service
│
└── Ledger Service           ◄── business services depend DOWN onto the ledger
        ├── Validator
        ├── Repository
        ├── Account Service
        ├── Balance Service
        └── Transaction Factory
```

```
Correct:   AI Usage Service ──► Ledger Service
Incorrect: Ledger Service ──► AI Usage Service   (forbidden)
```

The ledger must remain generic; it never imports or calls a business service.

## 4. Component responsibilities

| Component | Responsible for | NOT responsible for |
|---|---|---|
| **Ledger Service** | posting transactions, ensuring balance, persisting entries, updating projections, enforcing idempotency | Stripe, OpenAI, Anthropic, subscription plans, billing |
| **Validator** | enforcing the 5 invariants before persistence | persistence, business rules |
| **Repository** | insert transactions/entries, fetch balances & account info | business logic, validation |
| **Balance Service** | update/rebuild projections, validate balances | — |
| **Account Service** | create tenant wallets, fetch account IDs, resolve system accounts | — |
| **Transaction Factory** | generate transaction structures per type | submitting/persisting |

## 5. Folder structure

```
src/
  services/
    ├── ledger/
    │   ├── ledger.service.ts
    │   ├── ledger.validator.ts
    │   ├── ledger.repository.ts
    │   ├── balance.service.ts
    │   ├── account.service.ts
    │   ├── transaction.factory.ts
    │   ├── types.ts
    │   └── errors.ts
    ├── ai/
    │   └── ai-usage.service.ts
    ├── billing/
    │   └── purchase.service.ts
    ├── subscriptions/
    │   └── subscription.service.ts
    └── refunds/
        └── refund.service.ts
```

## 6. Data model

```ts
interface LedgerTransaction {
  tenantId: string;
  type: string;          // e.g. "AI_USAGE"
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  entries: LedgerEntry[];
}

interface LedgerEntry {
  accountId: string;
  amount: number;        // signed; debits negative, credits positive
}
```

**Accounts.** Tenant wallets + system accounts: `CREDIT_ISSUANCE`, `AI_CONSUMED`, `ADJUSTMENT`, `TENANT_WALLET`.

**Persistence tables (logical):**
- `ledger_entries` — immutable, **source of truth**.
- `account_balances` — **projection** for fast reads (derivable from `ledger_entries`).
- `UNIQUE(idempotency_key)` constraint on the transaction table.

## 7. Write entry point

```ts
await ledgerService.postTransaction(transaction);   // the ONLY way to move credits
// Never, from business code:
// prisma.ledgerEntries.create(...)
```

### `postTransaction` flow (atomic)
```
BEGIN TRANSACTION
  1. Check idempotency_key  → if exists, return prior result (DuplicateTransactionError or no-op replay)
  2. Validate (see §9)
  3. For each wallet being debited: SELECT ... FOR UPDATE (lock row)
  4. Re-check post-debit balance >= 0
  5. Insert transaction + entries
  6. Update account_balances projection
COMMIT
```
All locking and writes occur **inside one database transaction**.

## 8. Transaction Factory pattern

Business services never hand-build entries; they call factories:

```ts
LedgerFactory.createAIUsage(...)
LedgerFactory.createRefund(...)
LedgerFactory.createSubscriptionGrant(...)
LedgerFactory.createCreditPurchase(...)
LedgerFactory.createExpiration(...)
LedgerFactory.createTransfer(...)
```

Example output:
```ts
{
  type: "AI_USAGE",
  entries: [
    { accountId: walletId,   amount: -25 },
    { accountId: consumedId, amount: +25 },
  ],
}
```

## 9. Validation rules (Validator)

Validation runs **before** persistence. (Maps to PRD LR-VAL-*.)

| # | Rule | Check |
|---|---|---|
| 1 | Transaction balances | `SUM(entries.amount) === 0` |
| 2 | Minimum entries | `entries.length >= 2` |
| 3 | Valid accounts | every `accountId` exists |
| 4 | Idempotency | `idempotencyKey` present |
| 5 | No negative wallet | post-transaction wallet balance `>= 0` |

## 10. Repository layer

Responsible for: inserting transactions, inserting entries, fetching balances, fetching account info. **Not** responsible for business logic or validation. Keeps the domain framework-independent (the ORM lives behind this boundary).

## 11. Balance Service

- **Source of truth:** `ledger_entries`. **Projection:** `account_balances`.
- Responsibilities: update projections (on each post), rebuild projections (recompute from entries), validate balances (projection vs source reconciliation).

## 12. Account Service

- Create tenant wallets.
- Fetch account IDs.
- Resolve system accounts (`CREDIT_ISSUANCE`, `AI_CONSUMED`, `ADJUSTMENT`, `TENANT_WALLET`).

## 13. Concurrency handling

**Problem:** wallet has 10 credits; two simultaneous requests each cost 10. Without locking, both read 10, both succeed, balance becomes −10.

**Solution:** lock the wallet row inside a DB transaction:
```sql
SELECT * FROM account_balances WHERE account_id = ? FOR UPDATE;
```
The second request blocks until the first commits, then sees the updated balance and is rejected by validation rule 5.

## 14. Idempotency strategy

- Every transaction carries an `idempotency_key` (e.g. `usage_123`, `payment_456`, `refund_789`).
- `UNIQUE(idempotency_key)` at the DB level.
- Benefits: safe retries, no duplicate charges, no duplicate grants.

## 15. Error handling

```ts
throw new InsufficientCreditsError();   // rule 5 violation
throw new DuplicateTransactionError();  // idempotency conflict
throw new LedgerBalanceError();         // rule 1 violation (unbalanced)
throw new AccountNotFoundError();       // rule 3 violation
```

## 16. Testing strategy

- **Unit:** factories (correct entries per type), validators (each of the 5 rules), balance calculations.
- **Integration:** database transactions (atomicity/rollback), concurrency (two parallel debits → exactly one succeeds), idempotency (duplicate key → no double-apply).
- **Invariant:** every persisted transaction balances to zero — *always*. Run as a property/invariant test and as a production data check.

## 17. Consumer integration (example: AI Usage)

```
Call OpenAI/Anthropic
      │
      ▼
Calculate Credits        (business service responsibility)
      │
      ▼
Create Usage Record
      │
      ▼
LedgerFactory.createAIUsage(...) ──► ledgerService.postTransaction(...)
```
The AI Usage Service supplies the `idempotencyKey` (e.g. derived from the upstream request id). The ledger neither calls the AI provider nor computes credit cost.

## 18. Future extensions (no ledger redesign required)

Credit expiration buckets, promotional credits, referral credits, department budgets, parent/child accounts, cost-center reporting, multi-currency credits, multiple AI providers, event-driven processing. The generic transaction/entry model + factories + composed services absorb these as new factories/account types, not as ledger rewrites.

## 19. Risks, tradeoffs, open questions

- **Tradeoff:** row-level locking serializes per-wallet writes → simplicity & correctness over max throughput. Acceptable; revisit if hot-wallet contention appears.
- **Risk:** projection drift. *Mitigation:* rebuild + reconciliation (§11).
- **Open:** retention/archival for `ledger_entries`; expiration-bucket modeling (sub-accounts vs metadata); read-latency / posting-throughput SLOs.

## 20. Design summary

A generic, composition-based ledger: business services create transactions via factories; the ledger validates invariants, locks wallets, persists immutable entries atomically, and maintains fast balance projections — with idempotency preventing duplicates. This keeps the credit core correct, auditable, and isolated from billing, subscriptions, and AI provider integrations.
