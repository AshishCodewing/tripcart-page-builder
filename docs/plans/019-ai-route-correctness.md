# Plan 019: AI route correctness — abort propagation, error-path settlement, timer hygiene, context dedupe

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `docs/plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 9f96f3b..HEAD -- app/api/chat app/api/generate lib/billing/usage-middleware.ts lib/ai/copilot.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW — each fix shortens/settles work that is already abandoned
  or leaking; no happy-path behavior change except the (deliberate, small)
  selected-component cap in Step 4
- **Depends on**: docs/plans/018-billing-ai-unit-tests.md (its tests pin the
  modules this plan touches; update them here where behavior changes)
- **Category**: bug
- **Planned at**: commit `9f96f3b`, 2026-07-08

## Why this matters

Four defects in the AI request lifecycle, all found by audit on 2026-07-08:

1. When a user hits Stop (or closes the tab), the server-side agent loop and
   code generation run to completion anyway — and the billing middleware
   charges the tenant for the cancelled work, while OpenRouter spend
   continues. The chat route constructs an `AbortController` but nothing
   ever aborts it; the generate route has none at all.
2. `/api/generate`'s error path returns a 500 without registering Next's
   `after()` hook, so on a thrown error a serverless instance can freeze
   before an already-incurred charge settles and before Langfuse spans
   flush — a stranded charge and a lost trace exactly when you most want
   the trace.
3. `settledWithTimeout` leaves its 10-second `setTimeout` pending when the
   charge settles fast (the normal case), which can hold the serverless
   invocation open for the full 10s per request.
4. The chat context ships `selectedComponent.html` — a verbatim substring of
   the already-sent `pageHtml` — in the *uncached* prompt tier on every
   message, paying for those tokens twice per turn on large selections.

## Current state

- `app/api/chat/route.ts` — copilot chat endpoint.
  - Line 48–49:
    ```ts
    const params = await chatParamsFromRequest(request)
    const abortController = new AbortController()
    ```
  - Line 106 (inside the `chat({ ... })` options): `abortController,`
  - Nothing references `request.signal` or calls `.abort()` anywhere in the
    file. Lines 112–115 correctly register `after()` before returning.
- `app/api/generate/route.ts` — codegen endpoint behind the copilot's code
  tools.
  - Lines 90–113: `generate()` calls `streamToText(chat({ ... }))` with NO
    `abortController` option.
  - Lines 82–83: `const settledCharges: Array<Promise<void>> = []` declared
    OUTSIDE the `try` (line 85); each `generate()` pushes `billing.settled`.
  - Lines 131–134, inside the `try`:
    ```ts
    after(async () => {
      await settledWithTimeout(Promise.all(settledCharges))
      await langfuseSpanProcessor.forceFlush()
    })
    ```
  - Lines 150–155: the `catch` returns `jsonError(500, …)` — the `after()`
    above is never reached on this path.
- `lib/billing/usage-middleware.ts` lines 67–75:
  ```ts
  export function settledWithTimeout(
    settled: Promise<unknown>,
    ms = 10_000
  ): Promise<unknown> {
    return Promise.race([
      settled,
      new Promise<void>((resolve) => setTimeout(resolve, ms)),
    ])
  }
  ```
- `lib/ai/copilot.ts` lines 129–136 (tier 2, the uncached volatile block):
  ```ts
  if (ctx.selectedComponent)
    volatileParts.push(
      fencedBlock(
        `Selected Component (id: ${ctx.selectedComponent.id})`,
        "html",
        ctx.selectedComponent.html
      )
    )
  ```
  The full page HTML (which contains this markup, addressable by the same
  id) is already in tier 1 (lines 111–123).
- Conventions: Prettier (no semicolons, double quotes), TS strict. The
  TanStack AI `chat()` options type accepts `abortController` (see its use
  at chat/route.ts:106). `after` is imported from `next/server` in both
  routes already.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Typecheck | `pnpm typecheck`                 | exit 0              |
| Tests     | `pnpm test`                      | all pass            |
| Lint      | `pnpm lint`                      | exit 0              |
| Dev run   | `pnpm dev`                       | route compiles; manual check optional |

## Scope

**In scope**:
- `app/api/chat/route.ts`
- `app/api/generate/route.ts`
- `lib/billing/usage-middleware.ts` (only `settledWithTimeout`)
- `lib/ai/copilot.ts` (only the tier-2 selected-component block)
- `lib/ai/copilot.test.ts`, `lib/billing/usage-middleware.test.ts` (update
  the plan-018 tests where this plan changes pinned behavior; create the
  relevant cases if plan 018 has not run — do not write plan 018's full
  suite here)

**Out of scope** (do NOT touch):
- `components/ai/chat.tsx` / `copilot-tools.ts` — the client's `stop()`
  already tears down the fetch; no client change is needed for abort to
  propagate.
- `lib/billing/gate.ts`, request-body validation, tenantId handling — all
  plan 020.
- `lib/ai/codegen.ts` prompt structure / cache ordering — a separate,
  design-sensitive perf item (see README finding #10); not this plan.
- The billing middleware's charge logic (`settle`, `onUsage`).

## Git workflow

- Branch: `advisor/019-ai-route-correctness`
- Conventional commits, e.g. `fix(ai): propagate client abort to the agent loop and codegen`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Propagate client abort in both routes

In `app/api/chat/route.ts`, immediately after line 49
(`const abortController = new AbortController()`), add:

```ts
// A closed client connection must cancel the agent loop: otherwise the run
// (and its OpenRouter spend + billing) continues after the user hit Stop.
request.signal.addEventListener("abort", () => abortController.abort())
```

In `app/api/generate/route.ts`, create an `AbortController` near the top of
`POST` (after the body parse), wire the same listener, and pass
`abortController` into BOTH `chat({ ... })` calls' options (the `generate`
closure builds the options once — add it there, alongside `modelOptions`).

**Verify**: `pnpm typecheck` → exit 0. If the TanStack AI version rejects
`abortController` on the generate route's `chat()` options, that's a STOP
condition (see below), not a workaround opportunity.

### Step 2: Settle charges on `/api/generate`'s error path

Move the `after(...)` registration (currently lines 131–134) OUT of the
success path so it runs exactly once on every exit. Register it right after
`const settledCharges: Array<Promise<void>> = []` (line 83), before the
`try`:

```ts
const settledCharges: Array<Promise<void>> = []
// Registered before any generation so a thrown error can't skip it: the
// callback snapshots nothing — Promise.all reads the array at flush time.
after(async () => {
  await settledWithTimeout(Promise.all(settledCharges))
  await langfuseSpanProcessor.forceFlush()
})
```

Delete the old `after(...)` block inside the `try`. (`Promise.all` is called
when the callback runs — after the response — so charges pushed later are
included; an early 500 with an empty array resolves immediately.)

**Verify**: `pnpm typecheck` → exit 0; `grep -c "after(" app/api/generate/route.ts`
→ exactly 1 registration remains (plus the import line).

### Step 3: Clear the timer in `settledWithTimeout`

Replace the body so the timeout handle is cleared once the race resolves:

```ts
export function settledWithTimeout(
  settled: Promise<unknown>,
  ms = 10_000
): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms)
  })
  return Promise.race([settled, timeout]).finally(() => clearTimeout(timer))
}
```

Update/add the plan-018 fake-timer test: after the settled promise resolves,
`vi.getTimerCount()` returns 0.

**Verify**: `pnpm test lib/billing/usage-middleware.test.ts` → passes
(create the file with just the `settledWithTimeout` cases if plan 018 hasn't
run yet).

### Step 4: Cap the duplicated selected-component HTML

In `lib/ai/copilot.ts`, bound the tier-2 duplication instead of removing it
(the markup is redundant with tier-1 `pageHtml`, but small selections keep
answer quality and large ones are pure duplicate cost). Add a module
constant and change the block:

```ts
// The selected component's markup also exists inside the tier-1 page HTML
// (addressable by id), so beyond this size we send only the id reference.
const MAX_SELECTED_HTML_CHARS = 4000
```

```ts
if (ctx.selectedComponent) {
  const { id, html } = ctx.selectedComponent
  volatileParts.push(
    html.length <= MAX_SELECTED_HTML_CHARS
      ? fencedBlock(`Selected Component (id: ${id})`, "html", html)
      : block(
          `Selected Component (id: ${id})`,
          `[markup omitted — ${html.length} chars; locate it by id in the Page HTML above]`
        )
  )
}
```

Update the plan-018 copilot test: add a case with an oversize
`selectedComponent.html` asserting the omission text appears and the raw
HTML does not.

**Verify**: `pnpm test lib/ai/copilot.test.ts` → passes.

### Step 5: Full gate

**Verify**: `pnpm format`, then `pnpm typecheck` → exit 0, `pnpm lint` →
exit 0, `pnpm test` → all pass.

Optional live check (recommended if `OPENROUTER_API_KEY` is configured
locally): `pnpm dev`, open a tenant page editor, send a copilot message,
hit Stop mid-stream, and confirm via server logs that no charge posts for
the full run (the `[billing]` log line reports summed tokens — an aborted
run should report fewer tokens than a completed one, and the response
stream stops promptly).

## Test plan

- `lib/billing/usage-middleware.test.ts`: `settledWithTimeout` clears its
  timer (fake timers, `vi.getTimerCount() === 0` after fast settle).
- `lib/ai/copilot.test.ts`: oversize `selectedComponent.html` → omission
  message, no raw markup; small selection unchanged.
- Route-level abort/after() behavior is not unit-testable without a harness
  for streaming routes (deliberately out of scope); the grep + typecheck
  gates plus the optional live check cover it. Note this in the PR.

## Done criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `grep -n "request.signal" app/api/chat/route.ts app/api/generate/route.ts`
      → one match in each file
- [ ] `grep -n "abortController" app/api/generate/route.ts` → controller
      created and passed to the chat() options
- [ ] In `app/api/generate/route.ts`, `after(` appears before the `try` and
      not inside it
- [ ] `grep -n "clearTimeout" lib/billing/usage-middleware.ts` → one match
- [ ] `git status` shows only in-scope files modified
- [ ] `docs/plans/README.md` status row for 019 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The installed `@tanstack/ai` version's `chat()` options for the generate
  route reject `abortController` (typecheck error) — the API may differ for
  non-SSE usage; report the actual option name/shape you find in
  `node_modules/@tanstack/ai/dist/**/*.d.ts` instead of guessing.
- Aborting causes the billing middleware's `onAbort` NOT to fire (symptom in
  the optional live check: no `[billing]` settle at all on abort). That
  would mean aborted usage is now unbilled rather than partially billed —
  a product decision, not yours.
- `after()` registered before the `try` fails at runtime with a Next.js
  error about invocation context (would indicate a Next 16 constraint on
  where `after()` may be called; report, and fall back to duplicating the
  registration in both the `try` and the `catch` ONLY if the operator
  approves).
- Current-state excerpts don't match (drift).

## Maintenance notes

- If a future TanStack AI upgrade adds native `request.signal` support to
  `chatParamsFromRequest`/`toServerSentEventsResponse`, the manual listener
  in Step 1 becomes redundant — prefer the native path then.
- The 4000-char selected-HTML cap is a heuristic; if users report the model
  "not seeing" large selected sections, revisit by improving the id-locating
  instruction in the copilot prompt (Langfuse-managed) rather than raising
  the cap first.
- Plan 020 adds body validation to the chat route — it touches the same file
  as Step 1; whichever lands second rebases trivially.
