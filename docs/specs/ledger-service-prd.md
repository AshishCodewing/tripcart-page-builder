# Ledger Service — Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | AI Credit Wallet — Ledger Service |
| **Status** | Draft v1.0 |
| **Owner** | _TBD_ |
| **Last updated** | 2026-06-30 |
| **Related docs** | `ledger-service-tdd.md`, `ai-copilot-prd.md` (a credit consumer) |

---

## 1. Summary

The Ledger Service is the single, generic, double-entry accounting core for a multi-tenant AI SaaS credit wallet. Every credit movement — AI usage, subscription grants, credit purchases, refunds, expirations, transfers — is recorded as a balanced transaction through one write entry point. The ledger is deliberately decoupled from billing, subscriptions, and AI providers so it can stay correct, auditable, and reusable as new credit features are added.

## 2. Problem statement

A credit wallet that lets business logic write balances directly will, over time:

- Drift out of balance (no enforced invariants).
- Double-charge or double-grant on retries (no idempotency).
- Go negative under concurrent requests (no locking).
- Become unauditable (no immutable record of *why* a balance changed).
- Tightly couple billing/AI rules to storage, making every change risky.

We need an accounting core that makes these failure modes structurally impossible.

## 3. Goals & non-goals

### Goals
- Be **maintainable, testable, auditable, extensible, framework-independent**, and **safe from business-logic leakage**.
- Guarantee every transaction balances to zero — *always*.
- Be the **single write entry point** for all credit movement.
- Prevent duplicate charges/grants via idempotency.
- Prevent negative balances under concurrency.
- Provide fast wallet-balance reads.
- Support new credit types/features **without redesigning the ledger**.

### Non-goals (explicitly NOT the ledger's responsibility)
- Stripe / payment processing.
- OpenAI / Anthropic / AI provider calls.
- Subscription plans, billing, pricing.
- Calculating *how many* credits an action costs (that is the calling service's job).

## 4. Users & consumers

- **Business services** (AI Usage, Subscription, Credit Purchase, Refund) — construct transactions and submit them to the ledger.
- **Finance / Audit** — rely on the immutable entry log as source of truth.
- **Platform engineers** — extend the system with new credit types.

## 5. Key requirements

IDs are stable for traceability (RFC-2119 MUST/SHOULD).

### 5.1 Architecture & boundaries
- **LR-ARCH-1 (MUST)** Use **composition over inheritance** — small focused services (Validator, Repository, Balance Service, Account Service, Transaction Factory), not a `LedgerTransaction` base class with per-type subclasses.
- **LR-ARCH-2 (MUST)** Dependency direction is one-way: business services depend on the ledger; **the ledger must not depend on business services**.
- **LR-ARCH-3 (MUST)** The ledger operates on **generic transactions** (no Stripe/OpenAI/plan knowledge).

### 5.2 Single write entry point
- **LR-WRITE-1 (MUST)** All credit movement goes through `ledgerService.postTransaction(...)`.
- **LR-WRITE-2 (MUST)** Business code MUST NOT write entries directly (e.g. never `prisma.ledgerEntries.create(...)`).

### 5.3 Transaction construction
- **LR-TX-1 (MUST)** Business services build transactions via **factories**, not by hand-assembling entries.
- **LR-TX-2 (MUST)** Provide factories for: AI Usage, Refund, Subscription Grant, Credit Purchase, Expiration, Transfer.

### 5.4 Validation (before persistence)
- **LR-VAL-1 (MUST)** Transaction must balance: `SUM(entries.amount) = 0`.
- **LR-VAL-2 (MUST)** Minimum **2** entries.
- **LR-VAL-3 (MUST)** All referenced accounts must exist.
- **LR-VAL-4 (MUST)** `idempotencyKey` required.
- **LR-VAL-5 (MUST)** A wallet must not become negative.

### 5.5 Idempotency
- **LR-IDEM-1 (MUST)** Every transaction requires an `idempotency_key`.
- **LR-IDEM-2 (MUST)** `UNIQUE(idempotency_key)` enforced at the database level.
- **LR-IDEM-3 (MUST)** Outcome: safe retries, no duplicate charges, no duplicate grants.

### 5.6 Concurrency
- **LR-CONC-1 (MUST)** Concurrent debits against the same wallet must not overspend; serialize via row-level lock (`SELECT … FOR UPDATE`) inside a DB transaction.

### 5.7 Balances
- **LR-BAL-1 (MUST)** Source of truth = `ledger_entries`; `account_balances` is a projection for fast reads.
- **LR-BAL-2 (MUST)** Projections can be updated and **rebuilt** from entries; balances can be validated against the source.

### 5.8 Errors
- **LR-ERR-1 (MUST)** Typed errors: `InsufficientCreditsError`, `DuplicateTransactionError`, `LedgerBalanceError`, `AccountNotFoundError`.

## 6. Non-functional requirements

- **Auditability:** entries are immutable and explain every balance change.
- **Consistency:** persistence is atomic — validate, lock, insert entries, update projection within one DB transaction.
- **Testability:** factories, validators, balance math unit-testable in isolation; invariant tests assert "every transaction balances to zero, always."
- **Framework independence:** domain logic decoupled from the ORM/web framework.
- **Multi-tenancy:** every transaction is tenant-scoped.

## 7. Domain model (functional view)

- **Account** — a balance-bearing entity: tenant wallets and system accounts (e.g. `CREDIT_ISSUANCE`, `AI_CONSUMED`, `ADJUSTMENT`, `TENANT_WALLET`).
- **Transaction** — `{ tenantId, type, referenceType, referenceId, idempotencyKey, entries[] }`.
- **Entry** — `{ accountId, amount }`; positive and negative entries net to zero.

Example (AI usage of 25 credits):
```
[ { accountId: walletId,     amount: -25 },
  { accountId: aiConsumedId, amount: +25 } ]
```

## 8. Consumers & flows

- **AI Usage Service:** call AI provider → calculate credits → create usage record → post `AI_USAGE` transaction.
- **Subscription Service:** subscription lifecycle, monthly grants, upgrades/downgrades → builds + submits transactions.
- **Credit Purchase Service:** Stripe + payment validation + package logic → builds transactions (never writes entries directly).
- **Refund Service:** builds refund transactions.

## 9. Success metrics

- **Invariant:** 100% of transactions balance to zero (alert on any drift).
- **0** duplicate charges/grants attributable to retries.
- **0** negative wallet balances in production.
- Projection rebuild reconciles to source with **0** discrepancy.
- Wallet-balance read latency within target (fast-read SLO, TBD).

## 10. Out of scope (v1)

- Multi-currency conversion logic.
- Promotional/referral credit *business rules* (the ledger supports the entries; rules live in business services).
- Reporting/analytics UI.

## 11. Future extensions (must be supported without redesign)

Credit expiration buckets, promotional credits, referral credits, department budgets, parent/child accounts, cost-center reporting, multi-currency credits, multiple AI providers, event-driven processing.

## 12. Risks & open questions

- **Risk:** projection drift from the entry log. *Mitigation:* rebuild + validation tooling (LR-BAL-2).
- **Risk:** lock contention on hot wallets under high concurrency. *Mitigation:* short transactions; revisit if contention observed.
- **Open:** retention/archival policy for `ledger_entries`.
- **Open:** how expiration buckets are modeled (sub-accounts vs metadata).
- **Open:** SLO targets for read latency and posting throughput.
