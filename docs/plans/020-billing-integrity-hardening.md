# Plan 020: Billing integrity hardening — validated chat body, centralized tenant resolution, explicit gate policy

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `docs/plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 9f96f3b..HEAD -- app/api lib/billing lib/ai/copilot.ts .env.example`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. Plan 019 touches the same routes —
> if it landed first, its abort/after() changes are expected drift; rebase
> around them.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — touches the request contract of both AI routes; a too-
  tight cap or a wrong tenant-resolution failure mode breaks the copilot
- **Depends on**: docs/plans/018-billing-ai-unit-tests.md (safety net);
  independent of 019 but shares files — coordinate merge order
- **Category**: security
- **Planned at**: commit `9f96f3b`, 2026-07-08

## Why this matters

The app has no authentication anywhere (a known, recorded deferral — see
`docs/plans/README.md` "Known but unplanned" item 1), and the AI routes now
spend real money. Three concrete holes, audit-confirmed 2026-07-08:

1. The billed `tenantId` is client-supplied on all three routes (`/api/chat`,
   `/api/generate`, `/api/credits`) — anyone who can reach the deployment can
   burn an arbitrary tenant's credits, read any tenant's balance, or omit
   `tenantId` entirely and run *unmetered* generations, making the deploy an
   open OpenRouter cost proxy.
2. The chat body is completely unvalidated: `editorContext` is cast straight
   from the request into the system prompt with no size caps (the generate
   route caps `pageHtml`/`pageCss` at 400k chars via zod; chat caps nothing),
   so per-request input-token cost is attacker-controlled.
3. The credit gate fails OPEN on unexpected errors — deliberate
   ("availability over enforcement", `gate.ts:38`), but the stance is
   invisible and untestable from the outside.

Full auth is a product decision this plan must NOT attempt. What it does:
close the free-amplification holes that don't need auth (2), create the
single server-side seam where session-based tenant resolution will plug in
later (1), and make the fail-open stance an explicit, documented,
env-flippable policy (3). **Residual risk to state in the PR**: until real
auth lands, a caller can still name another tenant's id. The recorded
recommendation to the operator is to enable Vercel Deployment Protection on
the production deployment in the meantime (zero code, closes public access;
operator action — not an executor step).

## Current state

- `app/api/chat/route.ts` (131 lines):
  - Lines 53–63: `editorContext` is `params.forwardedProps?.editorContext ??
    {}` cast `as EditorContext` — no validation; `tenantId` is
    `params.forwardedProps?.tenantId` accepted when it's a non-empty string,
    else `null` (null ⇒ unmetered), under a `TODO(auth)` comment.
  - Line 65: `if (tenantId && !(await hasCredits(tenantId)))` → 402.
- `app/api/generate/route.ts` (156 lines):
  - Lines 25–51: zod `bodySchema` with 400k caps on `pageHtml`/`pageCss`,
    `tenantId: z.string().max(200).optional()` under the same `TODO(auth)`.
  - Lines 76–79: `const tenantId = parsed.data.tenantId ?? null`, same gate.
- `app/api/credits/route.ts` (23 lines): `GET` reads `?tenantId=` from the
  query string, returns `balances.getWalletBalance(tenantId)` as credits;
  `AccountNotFoundError` → `{ credits: null }`. Same `TODO(auth)`.
- `lib/ai/copilot.ts`:
  - Lines 69–77: `EditorContext` type — `pageHtml?`, `pageCss?`,
    `selectedComponent?: { id: string; html: string } | null`,
    `selectedIds?: string[]`, `currentPage?: { id, name } | null`,
    `devices?: Array<{ name?, width?, widthMedia? }>`, `isNewProject?: boolean`.
  - Lines 103–148: `buildCopilotSystemPrompts` feeds those fields verbatim
    into the prompt tiers.
- `lib/billing/gate.ts` (45 lines): `hasCredits` as excerpted in plan 018's
  Current state — two `return true // fail open` branches at lines 38 and 42.
- `components/ai/chat.tsx` lines 59–98: `gatherEditorContext` builds exactly
  the `EditorContext` shape; lines 127–130 forward `{ editorContext,
  tenantId }` as the request body extension. This is the legitimate client —
  the zod schema below must accept everything it produces.
- `.env.example` documents all runtime env vars with comments (see its
  existing style — comment block above each key).
- The client tenant source is `useEditorTenantId()` (chat.tsx:126); global
  template editing legitimately has NO tenant (unmetered by design — keep
  that behavior for now, it's the recorded plan-017 contract).
- Zod v4 is a dependency (`zod: ^4.4.3`), already imported in
  `app/api/generate/route.ts:4`.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Typecheck | `pnpm typecheck`                 | exit 0              |
| Tests     | `pnpm test`                      | all pass            |
| Lint      | `pnpm lint`                      | exit 0              |
| Dev run   | `pnpm dev`                       | copilot chat still works end-to-end |

## Scope

**In scope**:
- `app/api/chat/route.ts`
- `app/api/generate/route.ts`
- `app/api/credits/route.ts`
- `lib/billing/resolve-tenant.ts` (create)
- `lib/billing/resolve-tenant.test.ts` (create)
- `lib/billing/gate.ts` (env-flag branch only)
- `lib/billing/gate.test.ts` (extend plan-018 file, or create with just
  these cases if 018 hasn't run)
- `lib/ai/copilot.ts` (export a zod schema for `EditorContext` — type stays)
- `.env.example` (document the new flag)

**Out of scope** (do NOT touch):
- Building authentication/sessions — product decision, explicitly deferred.
- `components/ai/chat.tsx`, `copilot-tools.ts` — the legitimate client
  already sends a conforming body; no client change.
- `lib/ledger/**` — the ledger's own guards are correct and tested.
- Rate limiting — worth doing at the platform layer (Vercel WAF) rather
  than in-route; record as follow-up, don't hand-roll here.
- The unmetered-when-no-tenant behavior — keeping it is a recorded product
  decision (global template editing); do not reject tenantless requests.

## Git workflow

- Branch: `advisor/020-billing-integrity-hardening`
- Conventional commits, e.g. `feat(billing): validate chat context and centralize billed-tenant resolution`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Zod schema for the chat editor context

In `lib/ai/copilot.ts`, add an exported `editorContextSchema` (zod) directly
above the `EditorContext` type, and derive the type from it so the two can't
drift:

```ts
import { z } from "zod"

// Caps mirror /api/generate's bodySchema (400k page code, 10 devices) plus
// sane bounds on the selection fields. The client (gatherEditorContext in
// components/ai/chat.tsx) stays comfortably under all of them.
export const editorContextSchema = z.object({
  pageHtml: z.string().max(400_000).optional(),
  pageCss: z.string().max(400_000).optional(),
  selectedComponent: z
    .object({ id: z.string().max(200), html: z.string().max(400_000) })
    .nullish(),
  selectedIds: z.array(z.string().max(200)).max(50).optional(),
  currentPage: z
    .object({ id: z.string().max(200), name: z.string().max(500) })
    .nullish(),
  devices: z
    .array(
      z.object({
        name: z.string().max(200).optional(),
        width: z.string().max(50).optional(),
        widthMedia: z.string().max(50).optional(),
      })
    )
    .max(10)
    .optional(),
  isNewProject: z.boolean().optional(),
})

export type EditorContext = z.infer<typeof editorContextSchema>
```

Delete the old hand-written `EditorContext` type (lines 69–77). Keep the
"keep the two shapes in sync" comment but point it at the schema now.
Note `nullish()` (not `nullable()`): the client sends `null` for empty
selection and omits failed fields.

In `app/api/chat/route.ts`, replace the cast (lines 53–54) with:

```ts
const contextResult = editorContextSchema.safeParse(
  params.forwardedProps?.editorContext ?? {}
)
if (!contextResult.success) {
  return new Response(
    JSON.stringify({
      error: `Invalid editorContext: ${contextResult.error.issues[0]?.message}`,
    }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  )
}
const editorContext = contextResult.data
```

Also cap history defensively where `MAX_HISTORY_MESSAGES` is applied
(line 81): the slice already bounds message COUNT; no content-length cap on
messages is added here (the model's own context limit bounds it and
legitimate messages are typed by hand) — leave a one-line comment saying so.

**Verify**: `pnpm typecheck` → exit 0. `pnpm test` → plan-018 copilot tests
still pass (the schema-derived type is structurally identical).

### Step 2: Centralize billed-tenant resolution

Create `lib/billing/resolve-tenant.ts`:

```ts
/**
 * THE seam where the billed tenant is decided. Today the candidate comes
 * from the client (TODO(auth): replace with session-derived resolution —
 * this function is the single point to change). What it already enforces:
 * the id must be a non-empty string and must name a REAL tenant, so
 * arbitrary strings can't be metered, can't create junk wallets via the
 * gate's self-heal, and can't probe balances. null ⇒ unmetered run
 * (legitimate for global template editing).
 */
import { prisma } from "@/lib/prisma"

export async function resolveBilledTenant(
  candidate: unknown
): Promise<{ tenantId: string | null } | { error: "unknown_tenant" }> {
  if (typeof candidate !== "string" || candidate.length === 0)
    return { tenantId: null }
  if (candidate.length > 200) return { error: "unknown_tenant" }
  const tenant = await prisma.tenant.findUnique({
    where: { id: candidate },
    select: { id: true },
  })
  return tenant ? { tenantId: tenant.id } : { error: "unknown_tenant" }
}
```

Wire it into all three routes, replacing their inline tenantId logic:

- `app/api/chat/route.ts` (replaces lines 56–63): resolve
  `params.forwardedProps?.tenantId`; on `error` return 400
  `{"error":"Unknown tenant"}`; else use `tenantId` as before.
- `app/api/generate/route.ts` (replaces line 76): resolve
  `parsed.data.tenantId`; same 400 on error.
- `app/api/credits/route.ts`: resolve the query param; on `error` OR when
  resolution yields `null` keep returning `{ credits: null }` (the route is
  a cosmetic readout — don't leak which tenant ids exist via status codes;
  note this in a comment).

Keep each route's `TODO(auth)` comment but point it at
`lib/billing/resolve-tenant.ts` as the one place to change.

**Verify**: `pnpm typecheck` → exit 0.
`grep -rn "forwardedProps?.tenantId\|parsed.data.tenantId ??" app/api/` →
no remaining inline resolution (all three routes call
`resolveBilledTenant`).

### Step 3: Make the gate's fail-open stance an explicit policy

In `lib/billing/gate.ts`, introduce one function and use it at both
fail-open sites (lines 38 and 42):

```ts
/**
 * Policy for balance-check failures. Default is fail OPEN (availability
 * over enforcement — a DB blip must not brick the copilot for paying
 * tenants); set BILLING_GATE_FAIL_CLOSED=1 to prefer cost safety instead.
 * Either way the write path still clamps to the real balance
 * (lib/billing/ai-usage.service.ts), so fail-open bounds the loss to one
 * run's overage.
 */
function failOpen(): boolean {
  return process.env.BILLING_GATE_FAIL_CLOSED !== "1"
}
```

Replace `return true // fail open` (both sites) with `return failOpen()`.

Document in `.env.example`, matching its comment style:

```
# Billing gate behavior when the credit balance check itself errors.
# Unset/0 = fail open (AI keeps working, cost risk bounded by the charge
# clamp). 1 = fail closed (requests 402 until the ledger is reachable).
BILLING_GATE_FAIL_CLOSED=
```

**Verify**: `pnpm test lib/billing/gate.test.ts` → the plan-018 fail-open
cases pass unchanged (default), plus two new cases with
`vi.stubEnv("BILLING_GATE_FAIL_CLOSED", "1")` asserting both error branches
now return `false`.

### Step 4: Tests

Create `lib/billing/resolve-tenant.test.ts` (mock `@/lib/prisma` as in plan
018's gate tests): non-string → `{tenantId: null}`; empty string →
`{tenantId: null}`; >200 chars → error; unknown id → error; known id →
`{tenantId: id}`. Extend `lib/billing/gate.test.ts` per Step 3. Add one
chat-context schema test in `lib/ai/copilot.test.ts`: an oversize `pageHtml`
fails `editorContextSchema.safeParse`; the exact object shape produced by
`gatherEditorContext` (copy the field list from chat.tsx:72–97, including
`selectedComponent: null` and `selectedIds: []`) parses successfully.

**Verify**: `pnpm test` → all pass.

### Step 5: End-to-end sanity + full gate

`pnpm dev`, open a tenant page in the editor, send a copilot message →
normal streamed reply (the conforming client passes validation and tenant
resolution). Then `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`.

## Test plan

Enumerated in Steps 3–4. Pattern: `lib/billing/ai-usage.service.test.ts`
(fakes) and plan 018's `gate.test.ts` (module mocks, `vi.stubEnv`).

## Done criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `grep -rn "as EditorContext" app/api/` → no matches (cast replaced by
      safeParse)
- [ ] All three routes import from `@/lib/billing/resolve-tenant`
- [ ] `grep -n "BILLING_GATE_FAIL_CLOSED" lib/billing/gate.ts .env.example`
      → one match in each
- [ ] Manual editor chat round-trip works (Step 5)
- [ ] `git status` shows only in-scope files modified
- [ ] `docs/plans/README.md` status row for 020 updated; the residual-risk
      note (client-named tenant until auth) appears in the PR/commit body

## STOP conditions

Stop and report back (do not improvise) if:

- `chatParamsFromRequest` no longer exposes `forwardedProps` (TanStack AI
  drift) — report the actual param shape.
- The legitimate client payload FAILS the Step-1 schema in the Step-5 manual
  check (a real field the schema missed) — report the offending field and
  its size/shape; loosen only that field with a comment, and note it.
- You find yourself wanting to add session/cookie/token machinery — that is
  the auth project, explicitly out of scope. The seam function is the
  deliverable, not the auth.
- Plan 019 landed first and the routes' line numbers shifted such that any
  excerpt no longer matches semantically (not just by line number).

## Maintenance notes

- When auth lands, `resolveBilledTenant` is the only place that changes:
  swap the candidate-trusting branch for session lookup + membership check,
  and delete the routes' `TODO(auth)` comments. The IDOR dimension
  (tenant-scoping every id-based lookup repo-wide) is designed in THERE.
- The `/api/credits` "never 400 on unknown tenant" choice trades id-probing
  resistance for readout simplicity — revisit when auth exists.
- Rate limiting remains unaddressed in-app; recommended at the Vercel WAF
  layer. Recorded here so it isn't re-audited as a miss.
- Operator recommendation (no code): enable Vercel Deployment Protection on
  production until auth ships.
