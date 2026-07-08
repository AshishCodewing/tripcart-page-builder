# Plan 021: Ledger integration tests — the postTransaction DB semantics, in CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `docs/plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 9f96f3b..HEAD -- lib/ledger scripts/smoke-ledger.ts vitest.config.ts .github/workflows/ci.yml package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW — additive tests + a CI job change; no production code
- **Depends on**: none (independent of 018–020)
- **Category**: tests
- **Planned at**: commit `9f96f3b`, 2026-07-08

## Why this matters

`lib/ledger/ledger.service.ts`'s `postTransaction` is the single write entry
point for the credit ledger — real money. Its stated invariants (idempotent
replay, `FOR UPDATE` serialization, TENANT-only negative guard, atomic
projection update) live in DB semantics that the existing pure unit tests
(math/validator/factory) cannot reach. Today the only exercise of this logic
is `scripts/smoke-ledger.ts` against a developer's local DB — it never runs
in CI, so a regression in lock ordering, the replay short-circuit, or the
P2002→DuplicateTransactionError mapping would merge silently. This plan puts
those invariants under a Postgres-backed Vitest suite that runs on every PR.

## Current state

- `lib/ledger/ledger.service.ts` lines 31–88 — `postTransaction` runs inside
  `this.prisma.$transaction`: (a) replay check via
  `findTransactionByIdempotencyKey` → returns the ORIGINAL posted result;
  (b) account existence → `AccountNotFoundError`; (c)
  `repository.lockBalances` (`FOR UPDATE`); (d) negative guard — only
  accounts with `accountType === LedgerAccountType.TENANT` may not go below
  0 → `InsufficientCreditsError`; (e) insert; (f) projection upsert;
  (g) `rethrowP2002AsDuplicate` maps the unique-key race to
  `DuplicateTransactionError` (lines 109–117).
- `lib/ledger/index.ts` exports `createLedger()` returning
  `{ ledger, accounts, balances }`, plus the error classes, `LedgerFactory`,
  `ACCOUNT_CODES`, `UNITS_PER_CREDIT`. (`lib/billing/seed.ts` and
  `scripts/smoke-ledger.ts` show typical usage.)
- `scripts/smoke-ledger.ts` — the assertions to port. It: ensures system
  accounts; creates a throwaway tenant wallet; posts a grant
  (`LedgerFactory.createSubscriptionGrant`); asserts idempotent replay
  returns the same transaction id; posts AI usage; asserts overspend throws
  `InsufficientCreditsError` and leaves the balance unchanged; verifies the
  projection equals `SUM(entries)`; cleans up its rows. Uses
  `import "dotenv/config"` and the shared `prisma` client.
- `lib/prisma.ts` — the app's singleton Prisma client (driver adapter over
  `DATABASE_URL`).
- `vitest.config.ts` — single config: `environment: "node"`, `include:
  ["lib/**/*.test.ts", "components/**/*.test.ts", "hooks/**/*.test.ts"]`.
  Nothing loads `.env` for tests today (no test currently needs a DB).
- `.github/workflows/ci.yml` — one `verify` job: pnpm 10, Node 24, install,
  `prisma generate`, typecheck, lint, `pnpm test`. It sets a dummy
  `DATABASE_URL` env with the comment "CI must not see a real database"
  (that rationale predates this plan — prisma generate needs the var to
  exist, not to connect; a service container changes the story).
- `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.
- Prisma migrations live in `prisma/migrations/`; `prisma.config.ts` loads
  `DATABASE_URL` from `.env` via `dotenv/config`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm typecheck` | exit 0 |
| Unit tests (no DB) | `pnpm test` | all pass with NO database running |
| Integration tests | `pnpm test:integration` | all pass against local `DATABASE_URL` |
| Migrations | `pnpm prisma migrate deploy` | applies `prisma/migrations` |
| Local DB check | `psql "$DATABASE_URL" -c 'select 1'` (or rely on migrate) | connects |

## Scope

**In scope**:
- `lib/ledger/ledger.integration.test.ts` (create)
- `vitest.config.ts` (exclude `*.integration.test.ts` from the default run)
- `vitest.integration.config.ts` (create)
- `package.json` (add `test:integration` script)
- `.github/workflows/ci.yml` (Postgres service + migrate + integration step)

**Out of scope** (do NOT touch):
- Any production code under `lib/ledger/` — if a test exposes a real bug,
  STOP and report; do not fix the ledger in this plan.
- `scripts/smoke-ledger.ts` — keep it working as the local one-shot check;
  do not delete or rewrite it here.
- `lib/billing/**` (chargeAiUsage is already unit-tested with fakes).

## Git workflow

- Branch: `advisor/021-ledger-integration-tests`
- Conventional commits, e.g. `test(ledger): postTransaction integration suite + CI Postgres`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Split configs

In `vitest.config.ts`, add to the `test` block:
`exclude: [...configDefaults.exclude, "**/*.integration.test.ts"]`
(import `configDefaults` from `vitest/config`).

Create `vitest.integration.config.ts`:

```ts
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    // DB tests share one database; serialize files to avoid cross-file
    // interference on the shared system-account balance rows.
    fileParallelism: false,
    setupFiles: ["dotenv/config"],
  },
})
```

Add to `package.json` scripts:
`"test:integration": "vitest run --config vitest.integration.config.ts"`.

**Verify**: `pnpm test` → passes with no DB running (unchanged count).
`pnpm test:integration` → "No test files found" is the expected result at
this step ONLY if vitest exits 0 with the `--passWithNoTests` behavior;
vitest 4 exits 1 on none found, so just proceed — Step 2 creates the file.

### Step 2: `lib/ledger/ledger.integration.test.ts`

Model the setup/teardown on `scripts/smoke-ledger.ts`: unique
`tenantId = \`itest-${Date.now()}-${Math.random().toString(36).slice(2)}\``
per test (via a helper), track created transaction ids, and in `afterEach`
delete entries → transactions → the wallet's balance row → the wallet
account, then rebuild the touched system-account projections the way the
smoke script does. Instantiate the real bundle once per file:
`const { ledger, accounts, balances } = createLedger()`, and
`await accounts.ensureSystemAccounts()` in `beforeAll`.

Required cases (each named for the invariant it pins):

1. **grant posts and the projection matches** — post
   `LedgerFactory.createSubscriptionGrant` (see `lib/billing/seed.ts:24-34`
   for exact param shape); `balances.getWalletBalance(tenantId)` equals
   credits × `UNITS_PER_CREDIT`.
2. **idempotent replay returns the original** — post the same input object
   again; the returned `id` equals the first post's `id`; balance unchanged.
3. **concurrent same-key posts: one insert** — `Promise.allSettled` of two
   `postTransaction` calls with the same fresh `idempotencyKey`. Accept
   either interleaving: both fulfilled with the same transaction id
   (replay won) or one fulfilled + one rejected with
   `DuplicateTransactionError` (unique-insert race won). Assert the DB holds
   exactly ONE transaction row for that key and the balance moved once.
4. **overspend rejects and rolls back** — with a 5-credit balance, post an
   AI usage (`LedgerFactory.createAIUsage` — param shape in
   `lib/billing/ai-usage.service.ts:130-138`) for 10 credits → rejects with
   `InsufficientCreditsError`; balance still 5 credits; no transaction row
   was written for that key.
5. **system accounts may go negative** — the issuance grant in case 1
   already drives `CREDIT_ISSUANCE` negative; assert its projection is
   negative (the TENANT-only guard).
6. **unknown account id** → `AccountNotFoundError`, nothing written.
7. **projection equals SUM(entries)** — after cases run a grant + a usage on
   one tenant, compare `getWalletBalance` against a raw
   `prisma.ledgerEntry.aggregate` sum for the wallet account (adjust the
   model/field names to `prisma/schema.prisma` — check them, don't guess).

**Verify**: with a local Postgres and migrations applied
(`pnpm prisma migrate deploy`), `pnpm test:integration` → 7+ tests pass.
Run it TWICE in a row → second run also passes (cleanup works).

### Step 3: CI

Edit `.github/workflows/ci.yml`:

```yaml
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: ci
          POSTGRES_PASSWORD: ci
          POSTGRES_DB: ci
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U ci" --health-interval 5s
          --health-timeout 5s --health-retries 10
```

Update the job-level `DATABASE_URL` comment (it now IS a real database:
`postgresql://ci:ci@localhost:5432/ci` — the string happens to already
match). After the `pnpm test` step add:

```yaml
      - run: pnpm prisma migrate deploy
      - run: pnpm test:integration
```

Check whether the schema requires the `pgvector` extension (grep
`prisma/migrations` for `vector`): the RAG tables use pgvector, so if any
migration creates it, switch the service image to `pgvector/pgvector:pg16`
(same env/options) so `migrate deploy` succeeds.

**Verify**: `git push` is NOT yours to do — instead validate locally that
the workflow YAML parses (`node -e "require('js-yaml')"` is not available;
use `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"`
→ no output, exit 0) and note in your report that the CI run itself is the
final verification the operator will see on the PR.

## Test plan

The Step-2 case list is the deliverable. Structural pattern for
setup/teardown: `scripts/smoke-ledger.ts`. Pattern for assertions on error
classes: `lib/billing/ai-usage.service.test.ts`.

## Done criteria

- [ ] `pnpm test` passes with NO database running (integration files
      excluded from the default suite)
- [ ] `pnpm test:integration` passes twice consecutively against a local DB
- [ ] The 7 invariant cases above all exist by name
- [ ] `.github/workflows/ci.yml` has the Postgres service, `migrate deploy`,
      and `test:integration` steps; YAML parses
- [ ] `pnpm typecheck` and `pnpm lint` exit 0
- [ ] `git status` shows only in-scope files modified
- [ ] `docs/plans/README.md` status row for 021 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any invariant test FAILS against the real ledger code — that is a real
  money-path bug; report the failing case and the observed behavior, do not
  patch `lib/ledger/`.
- `prisma/migrations` cannot apply on a clean Postgres 16 (or
  pgvector/pg16) container — report the failing migration.
- The Prisma model/field names for transactions/entries/balances don't match
  what Step 2's cleanup assumes — read `prisma/schema.prisma` and adapt the
  cleanup only; if the schema lacks a way to identify this test's rows for
  cleanup, report instead of deleting broadly.
- Cleanup cannot restore system-account projections reliably (symptom:
  second consecutive run fails) after one fix attempt.

## Maintenance notes

- The suite serializes files (`fileParallelism: false`) because system
  accounts are shared rows; if integration files multiply and CI slows,
  move to a per-file schema (Postgres `CREATE SCHEMA` + `search_path`)
  rather than re-enabling parallelism blind.
- When the billing business layer grows (purchases/refunds — see plan 022
  and the deferred Stripe work), add their invariants HERE, not as new
  smoke scripts.
- `scripts/smoke-ledger.ts` becomes redundant once this is stable; retire
  it in a later hygiene pass (deliberately not in this plan).
