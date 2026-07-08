# Plan 022: Admin credit grant/remove — the first credit-replenishment path

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `docs/plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 9f96f3b..HEAD -- lib/billing lib/ledger lib/cms/tenant-actions.ts "app/admin/(shell)/tenants/[id]/page.tsx"`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW — additive; posts through the existing, guarded ledger write
  path
- **Depends on**: none (021's integration suite is a nice-to-have safety
  net, not a blocker; the factory + service used here are the ledger's
  already-shipped primitives)
- **Category**: direction (replenishment phase 1)
- **Planned at**: commit `9f96f3b`, 2026-07-08

## Why this matters

Tenants receive a one-time 200k-credit seed and every AI run spends from it —
but no replenishment path of any kind exists. The out-of-credits UI says
"Contact your administrator to top up your workspace"
(`components/ai/chat.tsx:316`) and the administrator has no way to do that:
`LedgerFactory.createManualAdjustment` is fully implemented and unit-tested
with zero callers. Once a tenant's seed runs out they are permanently 402'd.
This plan wires the smallest real replenishment: a grant/remove form on the
tenant admin page, posting a `MANUAL_ADJUSTMENT` through the existing ledger
service. (Stripe-backed purchase flows are a separate, deliberately deferred
effort — see Maintenance notes.)

## Current state

- `lib/ledger/transaction.factory.ts:138-162` — `createManualAdjustment(p)`:
  takes `{ tenantId, adjustmentAccountId, walletAccountId, credits: bigint,
  direction: "grant" | "remove", adminId, idempotencyKey, description? }`;
  `grant` moves credits ADJUSTMENT → wallet, `remove` the reverse. Sets
  `referenceType: "ADMIN"`, `referenceId: adminId`.
- `lib/ledger/types.ts:10-28` — `ACCOUNT_CODES.ADJUSTMENT` is a system
  account code; `SYSTEM_ACCOUNT_CODES` includes it, so
  `accounts.ensureSystemAccounts()` creates it.
- `lib/ledger/ledger.service.ts:31-88` — `postTransaction` enforces the
  TENANT-only negative guard: a `remove` larger than the wallet balance
  throws `InsufficientCreditsError`; system accounts may go negative
  (grants drive ADJUSTMENT negative — correct double-entry behavior).
- `lib/billing/seed.ts` — the exemplar for posting through the bundle:
  `ensureSystemAccounts()`, `getSystemAccountId(...)`,
  `ensureTenantWallet(tenantId)`, then `ledger.postTransaction(
  LedgerFactory.createX({...}))` with `DuplicateTransactionError` treated as
  success.
- `lib/billing/ai-usage.service.ts:30-42` — `BillingLedgerDeps`, the
  narrow injectable slice (`ledger`/`accounts`/`balances` Picks) used so
  unit tests can fake the ledger; `lib/billing/ai-usage.service.test.ts`
  shows the fake pattern (`makeDeps`).
- `lib/cms/tenant-actions.ts` — server-action conventions: `"use server"`
  file; actions take `(id, form: FormData)` via `.bind`, validate with
  thrown `Error`s, `redirect`/`updateTag` on success. Admin mutations are
  unguarded repo-wide (known deferral, `lib/cms/editor-draft-actions.ts:23`).
- `app/admin/(shell)/tenants/[id]/page.tsx` (67 lines) — RSC settings page:
  loads the tenant, renders an update form (`<section className="rounded-lg
  border p-4">` with `Label`/`Input`/`Button` from `components/ui`) and a
  delete form. New sections follow this exact shape.
- `app/api/credits/route.ts` + `lib/ledger` `balances.getWalletBalance`
  (`AccountNotFoundError` when no wallet yet) — how balances are read;
  `UNITS_PER_CREDIT` converts units → credits.
- `SEED_CREDITS = 200_000n` (`lib/billing/seed.ts:14`) for scale context.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0              |
| Tests     | `pnpm test`      | all pass            |
| Lint      | `pnpm lint`      | exit 0              |
| Dev run   | `pnpm dev`       | grant/remove works on a tenant page |

## Scope

**In scope**:
- `lib/billing/admin-adjustment.ts` (create — the domain function)
- `lib/billing/admin-adjustment.test.ts` (create)
- `lib/cms/credit-actions.ts` (create — the `"use server"` wrapper)
- `app/admin/(shell)/tenants/[id]/page.tsx` (add the Credits section)

**Out of scope** (do NOT touch):
- Stripe/checkout/purchase flows (`createCreditPurchase` stays uncalled) —
  deferred; requires the pricing TODOs in `lib/billing/pricing.ts:30,35,53`
  to be resolved first.
- Auth on the action — admin mutations are unguarded repo-wide by recorded
  decision; add the same `TODO(auth)` comment style as
  `lib/cms/editor-draft-actions.ts:23`, nothing more.
- The 402 copy in `components/ai/chat.tsx` and any editor-side credit UX.
- `lib/ledger/**` — consume it, never modify it.

## Git workflow

- Branch: `advisor/022-admin-credit-grant`
- Conventional commits, e.g. `feat(billing): admin credit grant/remove over the ledger adjustment factory`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Domain function `lib/billing/admin-adjustment.ts`

Follow `seed.ts`'s posting shape and `ai-usage.service.ts`'s DI pattern
(reuse `BillingLedgerDeps` — import the type; you will also need
`getSystemAccountId(ACCOUNT_CODES.ADJUSTMENT)` and `ensureTenantWallet`,
both already in the Pick):

```ts
export interface AdjustCreditsInput {
  tenantId: string
  credits: bigint            // whole credits, > 0n
  direction: "grant" | "remove"
  adminId: string            // free-form until auth exists
  /** Caller-supplied so a double-submitted form can't post twice. */
  idempotencyKey: string
  note?: string
}

export async function adjustTenantCredits(
  input: AdjustCreditsInput,
  deps: BillingLedgerDeps = defaultDeps
): Promise<{ status: "adjusted" | "duplicate" }>
```

Behavior: validate `credits > 0n` (throw `Error("credits must be positive")`);
`ensureSystemAccounts()`; resolve the ADJUSTMENT system account id and the
tenant wallet (`ensureTenantWallet` — a grant may be the wallet's first
transaction); post `LedgerFactory.createManualAdjustment({...,
idempotencyKey: \`admin-adjust:${input.idempotencyKey}\`, description:
input.note})`; catch `DuplicateTransactionError` → `{ status: "duplicate" }`.
Let `InsufficientCreditsError` (remove > balance) propagate — the action
surfaces it. Unlike `chargeAiUsage` this SHOULD throw on failure: an admin
watching a form needs the error, there is no user response to protect.

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Unit tests `lib/billing/admin-adjustment.test.ts`

Copy `makeDeps` from `lib/billing/ai-usage.service.test.ts` (extend the
accounts fake with an ADJUSTMENT id). Cases: grant posts one transaction
with entries `[{adjustment, -N×1000}, {wallet, +N×1000}]` and key
`admin-adjust:<key>`; remove flips the signs; `credits: 0n` throws before
any ledger call; `DuplicateTransactionError` → `{status: "duplicate"}`;
`InsufficientCreditsError` propagates.

**Verify**: `pnpm test lib/billing/admin-adjustment.test.ts` → all pass.

### Step 3: Server action `lib/cms/credit-actions.ts`

`"use server"` file, conventions from `lib/cms/tenant-actions.ts`:

- `export async function adjustCredits(tenantId: string, form: FormData)` —
  parse `credits` (`BigInt(String(form.get("credits")))` inside a try →
  throw `Error("Enter a whole number of credits.")` on failure),
  `direction` (must be `"grant"` or `"remove"`), `note` (optional, trim),
  and `idempotencyKey` from a hidden field (see Step 4). Verify the tenant
  exists (`prisma.tenant.findUnique`, throw if not). Call
  `adjustTenantCredits` with `adminId: "admin-ui"` and a
  `// TODO(auth): stamp the real actor once sessions exist` comment.
  Wrap `InsufficientCreditsError` into
  `Error("Cannot remove more credits than the wallet holds.")`.
  Finish with `revalidatePath(\`/admin/tenants/${tenantId}\`)` (import from
  `next/cache`) so the balance readout refreshes.

**Verify**: `pnpm typecheck` → exit 0.

### Step 4: Credits section on the tenant settings page

In `app/admin/(shell)/tenants/[id]/page.tsx`, after the existing details
`<section>`, add a Credits section matching the page's section markup
(`rounded-lg border p-4`, `Label`/`Input`/`Button`):

- Server-side, read the balance:
  ```ts
  import { AccountNotFoundError, balances, UNITS_PER_CREDIT } from "@/lib/ledger"
  const credits = await balances
    .getWalletBalance(id)
    .then((u) => u / UNITS_PER_CREDIT)
    .catch((e) => {
      if (e instanceof AccountNotFoundError) return null
      throw e
    })
  ```
  Render `{credits === null ? "No wallet yet" : \`${credits} credits\`}`
  (bigint renders via template string).
- One form, `action={adjustCredits.bind(null, id)}`: number `Input`
  `name="credits"` (`min="1"`, `step="1"`, required), a native `<select
  name="direction">` with grant/remove options (there is no shadcn Select
  usage on this page — a plain select styled with the Input classes is
  acceptable; do not add new UI deps), optional `Input name="note"`, and a
  hidden idempotency field:
  `<input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />`
  — minted per RENDER, so a double-click/duplicate POST of the same form
  replays as `duplicate` instead of double-granting. (RSC renders this
  server-side; `crypto.randomUUID` is available in the Node runtime.)

**Verify**: `pnpm dev`, open `/admin/tenants/<id>` for an existing tenant →
balance shows; grant 500 → page refreshes, balance +500; submit the SAME
form again from a stale tab (or re-POST) → no second grant; remove more
than the balance → the wrapped error surfaces (Next dev overlay/error UI);
remove 200 → balance −200. Confirm in the editor (`/api/credits` readout)
that the number matches.

### Step 5: Full gate

`pnpm format`, then `pnpm typecheck`, `pnpm lint`, `pnpm test` → all green.

## Test plan

Step 2's unit cases (pattern: `lib/billing/ai-usage.service.test.ts`).
The action + page are exercised by the Step-4 manual script — record the
manual results in the PR body. If plan 021's integration harness exists,
OPTIONALLY add one integration case there (grant → remove → balance round-
trip); do not block on it.

## Done criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `grep -rn "createManualAdjustment" lib/billing lib/cms` → called from
      `admin-adjustment.ts` (the factory finally has a caller)
- [ ] Manual Step-4 script performed and recorded (grant, idempotent
      re-submit, over-remove rejection, remove)
- [ ] `git status` shows only in-scope files modified
- [ ] `docs/plans/README.md` status row for 022 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `BillingLedgerDeps`' `accounts` Pick lacks a method you need (e.g.
  `getSystemAccountId` typing excludes ADJUSTMENT) — report; widening the
  Pick in `ai-usage.service.ts` is a one-line change but it's that plan's
  file, so flag it rather than silently editing.
- Posting a grant fails with `AccountNotFoundError` for the ADJUSTMENT
  account even after `ensureSystemAccounts()` — projection/seed drift;
  report.
- The tenant settings page has been restructured (drift) such that there is
  no details `<section>` to anchor on.
- You are tempted to add a client component for nicer UX (toasts, pending
  states) — the page is currently a pure RSC with plain form actions; match
  it. Note the UX polish as follow-up instead.

## Maintenance notes

- This is replenishment PHASE 1. Phase 2 (Stripe top-up over
  `createCreditPurchase`) is blocked on verifying the pricing TODOs
  (`lib/billing/pricing.ts:30,35,53`) and is a separate plan when green-lit.
- When auth lands, `adminId: "admin-ui"` must become the real actor id —
  grep for `TODO(auth)` in `lib/cms/credit-actions.ts`.
- The per-render idempotency key means a form left open for hours still
  posts once — but two DIFFERENT renders grant twice by design. If ops
  wants stricter dedupe (per tenant+day), change the key derivation in the
  action, not the form.
- Reviewer should scrutinize: bigint handling in the action (no
  `parseInt` — `BigInt()` only), and that `remove` propagates
  `InsufficientCreditsError` rather than clamping (admin removal must be
  exact or fail).
