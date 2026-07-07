/**
 * TanStack AI ChatMiddleware that meters token usage and posts the charge.
 *
 * Usage arrives via `onUsage`, which fires once per agent-loop iteration that
 * reports usage — we sum across iterations (`onFinish`'s `info.usage` is the
 * LAST iteration only, so it would undercount multi-iteration runs). Exactly
 * one of onFinish/onAbort/onError fires per run (SDK contract), and the
 * engine awaits it before the stream generator completes, so the charge posts
 * before the response closes.
 *
 * `settled` resolves once the charge attempt is done (or skipped). Routes race
 * it with a timeout inside `after()` so a frozen serverless instance can't
 * strand an in-flight charge and a hung run can't hang the function.
 */
import type { ChatMiddleware, ChatMiddlewareContext } from "@tanstack/ai"
import { chargeAiUsage } from "./ai-usage.service"

export function createBillingMiddleware(p: {
  /** null ⇒ observe-only: no tenant to bill (e.g. global template editing). */
  tenantId: string | null
  source: "copilot" | "codegen"
}): { middleware: ChatMiddleware; settled: Promise<void> } {
  const usageId = crypto.randomUUID()
  let inputTokens = 0
  let outputTokens = 0

  let resolveSettled!: () => void
  const settled = new Promise<void>((resolve) => {
    resolveSettled = resolve
  })

  // chargeAiUsage never throws; the try/finally guards the contract that
  // `settled` always resolves regardless.
  async function settle(ctx: ChatMiddlewareContext) {
    try {
      if (p.tenantId && inputTokens + outputTokens > 0) {
        await chargeAiUsage({
          tenantId: p.tenantId,
          model: ctx.model,
          inputTokens,
          outputTokens,
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
    onUsage(_ctx, usage) {
      inputTokens += usage.promptTokens ?? 0
      outputTokens += usage.completionTokens ?? 0
    },
    onFinish: (ctx) => settle(ctx),
    onAbort: (ctx) => settle(ctx),
    onError: (ctx) => settle(ctx),
  }

  return { middleware, settled }
}

/** `after()` helper: wait for the charge, but never longer than `ms`. */
export function settledWithTimeout(
  settled: Promise<unknown>,
  ms = 10_000
): Promise<unknown> {
  return Promise.race([
    settled,
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ])
}
