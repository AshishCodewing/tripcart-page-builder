# Plan 018: Unit tests for the billing gate, usage middleware, and AI prompt builders

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `docs/plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 9f96f3b..HEAD -- lib/billing lib/ai app/api`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
> Note: at planning time `lib/ai/codegen.ts` carried uncommitted WIP whose
> diff was prompt-text only (the `CODEGEN_FALLBACK_PROMPT` string). The
> function signatures excerpted below are from the working tree. If
> `parseGeneratedCode`, `buildCodegenSystemPrompts`, `buildCodegenMessages`,
> or `mediaQuerySection` differ structurally from the excerpts, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (additive test files only)
- **Depends on**: none — and plans 019/020 modify the code these tests pin,
  so land this FIRST
- **Category**: tests
- **Planned at**: commit `9f96f3b`, 2026-07-08

## Why this matters

Every AI request in this product flows through four small untested modules:
`lib/billing/gate.ts` decides whether a paid run starts (and deliberately
fails open on errors), `lib/billing/usage-middleware.ts` accumulates the token
counts every charge is computed from, and the prompt builders in `lib/ai/`
define the cache-tier contract that keeps OpenRouter prompt-caching (= cost)
working, plus `parseGeneratedCode` which decides whether a paid generation is
accepted, retried (a second full paid generation), or 422'd. All of them are
pure or dependency-injectable, so this is cheap insurance on the money path.
Plans 019 and 020 modify this exact code; these tests are their safety net.

## Current state

- `lib/billing/gate.ts` — `hasCredits(tenantId)` (lines 17–44). Branches:
  balance `> 0n` → true; `AccountNotFoundError` → look up the tenant in
  Prisma, unknown tenant → `false`, known tenant → `seedTenantCredits` then
  re-check; seed failure → `return true // fail open`; any other error →
  `return true // fail open`. It imports `balances` from `@/lib/ledger`,
  `prisma` from `@/lib/prisma`, and `seedTenantCredits` from `./seed`
  directly (no dependency injection) — tests must use `vi.mock`.
- `lib/billing/usage-middleware.ts` — `createBillingMiddleware({tenantId, source})`
  returns `{ middleware, settled }`. `onUsage` sums
  `usage.promptTokens`/`usage.completionTokens` across calls (lines 54–57);
  `onFinish`/`onAbort`/`onError` each call `settle(ctx)` which calls
  `chargeAiUsage` only when `p.tenantId && inputTokens + outputTokens > 0`
  and always resolves `settled` via try/finally (lines 34–50).
  `settledWithTimeout(settled, ms = 10_000)` races the promise against a
  `setTimeout` (lines 67–75).
- `lib/ai/copilot.ts` — `buildCopilotSystemPrompts(promptText, ctx)` (lines
  103–148) returns 1–3 `SystemPrompt` entries: tier 0 is always
  `{ content: promptText, metadata: { cache_control: { type: "ephemeral" } } }`;
  tier 1 (`# Current website state`, also ephemeral) exists only when
  `pageHtml`/`pageCss`/`devices` present; tier 2 (`# Current selection`, NO
  metadata) exists only when selection/page/isNewProject fields present.
- `lib/ai/codegen.ts` —
  - `parseGeneratedCode(text)` (lines 223–229): extracts the inner content of
    the first `<generated_code>…</generated_code>` pair (non-greedy regex),
    trims it, returns `null` when there is no match or the trimmed inner is
    empty.
  - `mediaQuerySection(devices)` (lines 155–163): returns `""` for no devices
    or devices without `widthMedia`; otherwise a `## Allowed media queries`
    block with one `@media (max-width: …)` line per device that has
    `widthMedia`.
  - `buildCodegenSystemPrompts(promptText, req)` (lines 172–203): returns
    exactly 2 entries — `[{ content: promptText, metadata: EPHEMERAL },
    { content: parts.join("\n\n") }]`. `parts` starts with
    `ACTION_PREAMBLES[req.action]`, then optional target-position /
    SELECTED_COMPONENT_IDS / media-query sections, then a final
    `# CURRENT_CODE` block containing `## Current page HTML` and/or
    `## Current page CSS` fenced blocks when `req.pageHtml`/`req.pageCss`
    are set.
  - `buildCodegenMessages(req)` (lines 208–219): returns
    `[{ role: "user", content: req.userMessage?.trim() || req.plan },
    { role: "assistant", content: \`Plan: ${req.plan}\` }]`.
- Both `lib/ai/copilot.ts` and `lib/ai/codegen.ts` execute
  `new LangfuseClient()` at module top level (copilot.ts:28, codegen.ts:60).
  The constructor only reads env vars; it does not call the network. Vitest
  imports of these modules work without Langfuse keys.
- Test conventions: Vitest, node environment, files matched by
  `lib/**/*.test.ts` (vitest.config.ts). The structural exemplar is
  `lib/billing/ai-usage.service.test.ts` — `describe`/`it`, `vi.fn()`
  fakes, `beforeEach` with `vi.restoreAllMocks()` and console spies to
  silence expected `console.error`/`console.warn` output.

## Commands you will need

| Purpose   | Command                          | Expected on success        |
|-----------|----------------------------------|----------------------------|
| Install   | `pnpm install --frozen-lockfile` | exit 0                     |
| Typecheck | `pnpm typecheck`                 | exit 0, no errors          |
| All tests | `pnpm test`                      | all pass (299 pre-existing + new) |
| One file  | `pnpm test lib/billing/gate.test.ts` | that file passes       |
| Lint      | `pnpm lint`                      | exit 0                     |
| Format    | `pnpm format`                    | rewrites files; run before final commit |

## Scope

**In scope** (create only; no production code changes):
- `lib/billing/gate.test.ts` (create)
- `lib/billing/usage-middleware.test.ts` (create)
- `lib/ai/copilot.test.ts` (create)
- `lib/ai/codegen.test.ts` (create)

**Out of scope** (do NOT touch):
- Any file under `lib/billing/`, `lib/ai/`, `app/api/` other than the new
  test files — if a test reveals a bug, record it in your report; do not fix
  production code in this plan (plans 019/020 own those changes).
- `lib/ledger/**` — DB-integration testing of the ledger is plan 021.
- `lib/billing/seed.ts` testing beyond mocking it inside gate tests.

## Git workflow

- Branch: `advisor/018-billing-ai-unit-tests`
- Conventional commits, e.g. `test(billing): cover hasCredits fail-open and self-heal branches`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `lib/billing/gate.test.ts`

Mock the three collaborators at module level (gate.ts has no DI):

```ts
vi.mock("@/lib/ledger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ledger")>()
  return { ...actual, balances: { getWalletBalance: vi.fn() } }
})
vi.mock("@/lib/prisma", () => ({
  prisma: { tenant: { findUnique: vi.fn() } },
}))
vi.mock("@/lib/billing/seed", () => ({ seedTenantCredits: vi.fn() }))
```

Keep the real `AccountNotFoundError` from the actual module (spread
`actual`) so `instanceof` checks in gate.ts still work. Cases to cover:

1. balance `1n` → `true`; balance `0n` → `false`.
2. `getWalletBalance` throws `AccountNotFoundError`, `prisma.tenant.findUnique`
   returns `null` → `false`, and `seedTenantCredits` was NOT called.
3. `AccountNotFoundError`, tenant exists, seed succeeds, re-check returns a
   positive balance → `true`, `seedTenantCredits` called once with the id.
4. `AccountNotFoundError`, tenant exists, `seedTenantCredits` rejects →
   `true` (fail open).
5. `getWalletBalance` throws a plain `Error` → `true` (fail open).

**Verify**: `pnpm test lib/billing/gate.test.ts` → 5+ tests pass.

### Step 2: `lib/billing/usage-middleware.test.ts`

Mock `./ai-usage.service`'s `chargeAiUsage` with `vi.mock`. Drive the
middleware object directly — call `middleware.onUsage(ctx, usage)` etc. with
minimal fake `ctx` objects (`{ model: "m", threadId: "t" } as any` is
acceptable here). Cases:

1. Two `onUsage` calls (`{promptTokens: 100, completionTokens: 20}` then
   `{promptTokens: 50, completionTokens: 30}`) followed by `onFinish` →
   `chargeAiUsage` called once with `inputTokens: 150, outputTokens: 50`.
2. `tenantId: null` + usage + `onFinish` → `chargeAiUsage` NOT called, and
   `settled` still resolves (await it with a short real timeout).
3. Zero usage + `onFinish` → `chargeAiUsage` NOT called, `settled` resolves.
4. `onAbort` and `onError` also settle (parametrize over the three hooks).
5. `usage.promptTokens` undefined → treated as 0 (no NaN).
6. `settledWithTimeout`: with `vi.useFakeTimers()`, a never-resolving promise
   resolves after advancing 10_000ms; a pre-resolved promise wins immediately.

**Verify**: `pnpm test lib/billing/usage-middleware.test.ts` → all pass.

### Step 3: `lib/ai/copilot.test.ts`

No mocking needed — `buildCopilotSystemPrompts` is pure. Assert the tier
contract, not exact prose:

1. Empty ctx → exactly 1 prompt, `content === promptText`,
   `metadata.cache_control.type === "ephemeral"`.
2. `pageHtml` + `pageCss` + `devices` → 2 prompts; second starts with
   `# Current website state`, contains both fenced blocks, and HAS ephemeral
   metadata.
3. Selection fields only (`selectedComponent`, `selectedIds`, `currentPage`,
   `isNewProject: false`) → 2 prompts; second starts with
   `# Current selection` and has NO `metadata` key.
4. All fields → 3 prompts in order [static, website state, selection]; only
   the first two carry `cache_control` (this is the cache-prefix stability
   contract from copilot.ts:93-101 — name the test accordingly).
5. `isNewProject: false` still emits the block (the check is
   `!== undefined`), while omitting it does not.

**Verify**: `pnpm test lib/ai/copilot.test.ts` → all pass.

### Step 4: `lib/ai/codegen.test.ts`

Pure functions; import directly. Cases:

- `parseGeneratedCode`: well-formed tag → inner content trimmed; text with
  no tag → `null`; empty/whitespace-only inner → `null`; two tag pairs →
  content of the FIRST (non-greedy); surrounding chatter outside the tag is
  ignored; multiline inner preserved.
- `mediaQuerySection` (exported? if NOT exported, test it through
  `buildCodegenSystemPrompts` — check the file; at planning time it is a
  module-level function without `export`): no devices / devices without
  `widthMedia` → no `## Allowed media queries` section in the output;
  devices with `widthMedia: "768px"` → a `@media (max-width: 768px)` line.
- `buildCodegenSystemPrompts`: always exactly 2 entries; first is
  `promptText` with ephemeral metadata; second has NO metadata; `action:
  "add"` with `targetIds`/`position`/`componentName` emits the
  `## Target position` block; `action: "edit"` with `targetIds` emits
  `SELECTED_COMPONENT_IDS: a, b`; `pageHtml`/`pageCss` land inside a
  `# CURRENT_CODE` section that is the LAST part of the content.
- `buildCodegenMessages`: `userMessage` present → user content is the
  trimmed userMessage; absent/blank → falls back to `plan`; second message
  is `role: "assistant"` starting with `Plan: `.

**Verify**: `pnpm test lib/ai/codegen.test.ts` → all pass.

### Step 5: Full gate

**Verify**: `pnpm typecheck` → exit 0. `pnpm lint` → exit 0. `pnpm format`
then `pnpm test` → 299 pre-existing tests still pass plus the new files
(expect roughly 30+ new tests).

## Test plan

This plan IS the test plan; the case lists above are the deliverable.
Structural pattern: `lib/billing/ai-usage.service.test.ts`.

## Done criteria

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0; the four new test files exist and each contains
      the enumerated cases
- [ ] `git status` shows only the four new test files (plus this plan's
      README row) modified/added
- [ ] `docs/plans/README.md` status row for 018 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Importing `lib/ai/copilot.ts` or `lib/ai/codegen.ts` in Vitest throws at
  module load (e.g. `LangfuseClient` starts requiring env/network at
  construction after a dependency bump).
- The `vi.mock("@/lib/ledger")` partial-mock approach breaks `instanceof
  AccountNotFoundError` inside gate.ts (symptom: fail-open branch taken in
  the self-heal test). Report rather than restructuring gate.ts — adding DI
  to gate.ts belongs to plan 020.
- Any excerpted function signature/behavior differs from "Current state"
  (drift — plans 019/020 may have landed first; re-read their diffs and
  report which assertions need re-basing).
- A test reveals an actual production bug (e.g. NaN token summing). Write
  the test to pin CURRENT behavior, mark it with a `// BUG:` comment, and
  report it — do not change production code.

## Maintenance notes

- Plans 019 and 020 deliberately change some pinned behavior (019 caps
  `selectedComponent.html`; 020 adds validation and may flip the gate's
  fail-open default behind an env flag). Their executors are instructed to
  update these tests alongside — a reviewer seeing these tests change in
  019/020 PRs should check the change matches those plans' intent.
- If TanStack AI changes the middleware hook contract (`onUsage` shape,
  terminal-hook exactly-once), the usage-middleware tests are the tripwire.
