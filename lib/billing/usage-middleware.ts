/**
 * TanStack AI ChatMiddleware that meters token usage and posts the charge.
 *
 * Usage arrives via `onUsage`, which fires once per agent-loop iteration that
 * reports usage — we sum across iterations (`onFinish`'s `info.usage` is the
 * LAST iteration only, so it would undercount multi-iteration runs). Each
 * event also carries OpenRouter's provider-reported `cost`; we sum it as
 * ceiled micro-USD and forward it as the preferred price basis, but only when
 * EVERY iteration reported one — a single gap drops the whole run back to
 * token-table pricing so a missing field can't undercharge. Exactly
 * one of onFinish/onAbort/onError fires per run (SDK contract), and the
 * engine awaits it before the stream generator completes, so the charge posts
 * before the response closes — EXCEPT when the run pauses for client-side
 * tool execution/approval: the engine treats that as "paused, not finished"
 * (`toolPhase === 'wait'`) and fires NO terminal hook, even though the HTTP
 * request is over and its usage is final. Routes must therefore call
 * `flush()` inside `after()` — it charges whatever accumulated if no
 * terminal hook ran, and is a no-op otherwise (guarded here, and the ledger's
 * `usageId` idempotency key backstops any race).
 *
 * `settled` resolves once the charge attempt is done (or skipped). Routes race
 * `flush()` with a timeout inside `after()` so a frozen serverless instance
 * can't strand an in-flight charge and a hung run can't hang the function.
 */
import type { ChatMiddleware, ChatMiddlewareContext } from "@tanstack/ai"
import { chargeAiUsage } from "./ai-usage.service"

export function createBillingMiddleware(p: {
  /** null ⇒ observe-only: no tenant to bill (e.g. global template editing). */
  tenantId: string | null
  source: "copilot" | "codegen"
}): {
  middleware: ChatMiddleware
  settled: Promise<void>
  /** Settle now if no terminal hook fired (client-tool pause); else no-op. */
  flush: () => Promise<void>
} {
  const usageId = crypto.randomUUID()
  let inputTokens = 0
  let outputTokens = 0
  let reportedMicroUsd = 0n
  let costMissing = false
  let lastCtx: ChatMiddlewareContext | null = null
  let settleStarted = false

  let resolveSettled!: () => void
  const settled = new Promise<void>((resolve) => {
    resolveSettled = resolve
  })

  // chargeAiUsage never throws; the try/finally guards the contract that
  // `settled` always resolves regardless.
  async function settle(ctx: ChatMiddlewareContext) {
    if (settleStarted) return settled
    settleStarted = true
    try {
      if (p.tenantId && inputTokens + outputTokens > 0) {
        await chargeAiUsage({
          tenantId: p.tenantId,
          model: ctx.model,
          inputTokens,
          outputTokens,
          reportedMicroUsd: costMissing ? undefined : reportedMicroUsd,
          usageId,
          source: p.source,
          threadId: ctx.threadId,
        })
      }
    } finally {
      resolveSettled()
    }
  }

  const middleware: ChatMiddleware = {
    name: "billing",
    onStart(ctx) {
      lastCtx = ctx
    },
    onUsage(ctx, usage) {
      lastCtx = ctx
      inputTokens += usage.promptTokens ?? 0
      outputTokens += usage.completionTokens ?? 0
      // Per-iteration ceil so float dollars → integer micro-USD rounds in the
      // platform's favor. cost === 0 is a valid report (e.g. fully cached),
      // distinct from cost missing.
      if (typeof usage.cost === "number" && Number.isFinite(usage.cost)) {
        reportedMicroUsd += BigInt(Math.ceil(Math.max(0, usage.cost) * 1e6))
      } else {
        costMissing = true
      }
    },
    onFinish: (ctx) => settle(ctx),
    onAbort: (ctx) => settle(ctx),
    onError: (ctx) => settle(ctx),
  }

  // For runs that pause for the client (no terminal hook): by the time
  // `after()` runs the response has fully streamed, so usage is final and
  // charging what accumulated is safe. Continuation requests bill themselves.
  function flush(): Promise<void> {
    if (!settleStarted) {
      if (lastCtx) return settle(lastCtx)
      resolveSettled() // no model call ever started — nothing to bill
    }
    return settled
  }

  return { middleware, settled, flush }
}

/** `after()` helper: wait for the charge, but never longer than `ms`. Clears
 * the timeout once the race settles so a fast charge (the normal case) can't
 * hold the serverless invocation open for the full `ms`. */
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
