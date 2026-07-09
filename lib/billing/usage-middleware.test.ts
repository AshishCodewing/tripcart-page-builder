import { beforeEach, describe, expect, it, vi } from "vitest"

import { chargeAiUsage } from "./ai-usage.service"
import { createBillingMiddleware } from "./usage-middleware"

vi.mock("./ai-usage.service", () => ({
  chargeAiUsage: vi.fn(async () => ({ status: "charged", credits: 1n })),
}))

const mockCharge = vi.mocked(chargeAiUsage)

// Only ctx.model/ctx.threadId are read by the middleware.
const ctx = { model: "openai/gpt-5-mini", threadId: "t-1" } as never

function usage(p: { prompt: number; completion: number; cost?: number }) {
  return {
    promptTokens: p.prompt,
    completionTokens: p.completion,
    totalTokens: p.prompt + p.completion,
    ...(p.cost !== undefined ? { cost: p.cost } : {}),
  }
}

describe("createBillingMiddleware", () => {
  beforeEach(() => {
    mockCharge.mockClear()
  })

  it("sums tokens and reported cost (ceiled micro-USD) across iterations", async () => {
    const { middleware, settled } = createBillingMiddleware({
      tenantId: "tenant-1",
      source: "copilot",
    })
    middleware.onUsage!(ctx, usage({ prompt: 10, completion: 5, cost: 0.0001 }))
    middleware.onUsage!(
      ctx,
      usage({ prompt: 20, completion: 15, cost: 0.0000015 })
    )
    await middleware.onFinish!(ctx, {} as never)
    await settled

    expect(mockCharge).toHaveBeenCalledOnce()
    expect(mockCharge.mock.calls[0][0]).toMatchObject({
      tenantId: "tenant-1",
      inputTokens: 30,
      outputTokens: 20,
      // 100µ$ + ceil(1.5µ$) = 102µ$ — per-iteration ceil, platform's favor.
      reportedMicroUsd: 102n,
    })
  })

  it("drops reported cost for the whole run when any iteration lacks it", async () => {
    const { middleware, settled } = createBillingMiddleware({
      tenantId: "tenant-1",
      source: "codegen",
    })
    middleware.onUsage!(ctx, usage({ prompt: 10, completion: 5, cost: 0.0001 }))
    middleware.onUsage!(ctx, usage({ prompt: 20, completion: 15 }))
    await middleware.onFinish!(ctx, {} as never)
    await settled

    expect(mockCharge.mock.calls[0][0]).toMatchObject({
      inputTokens: 30,
      outputTokens: 20,
      reportedMicroUsd: undefined,
    })
  })

  it("treats a reported cost of 0 as a report, not a gap", async () => {
    const { middleware, settled } = createBillingMiddleware({
      tenantId: "tenant-1",
      source: "copilot",
    })
    middleware.onUsage!(ctx, usage({ prompt: 10, completion: 5, cost: 0 }))
    await middleware.onFinish!(ctx, {} as never)
    await settled

    expect(mockCharge.mock.calls[0][0]).toMatchObject({
      reportedMicroUsd: 0n,
    })
  })

  it("flush() charges a run that paused for client tools (no terminal hook)", async () => {
    const { middleware, flush } = createBillingMiddleware({
      tenantId: "tenant-1",
      source: "copilot",
    })
    middleware.onStart!(ctx)
    middleware.onUsage!(ctx, usage({ prompt: 10, completion: 5, cost: 0.0001 }))
    // No onFinish/onAbort/onError — the engine skips them on toolPhase 'wait'.
    await flush()

    expect(mockCharge).toHaveBeenCalledOnce()
    expect(mockCharge.mock.calls[0][0]).toMatchObject({
      inputTokens: 10,
      outputTokens: 5,
      reportedMicroUsd: 100n,
    })
  })

  it("flush() after a normal finish does not double-charge", async () => {
    const { middleware, flush, settled } = createBillingMiddleware({
      tenantId: "tenant-1",
      source: "copilot",
    })
    middleware.onUsage!(ctx, usage({ prompt: 10, completion: 5, cost: 0.0001 }))
    await middleware.onFinish!(ctx, {} as never)
    await flush()
    await settled

    expect(mockCharge).toHaveBeenCalledOnce()
  })

  it("flush() resolves without charging when no model call ever started", async () => {
    const { flush } = createBillingMiddleware({
      tenantId: "tenant-1",
      source: "copilot",
    })
    await flush()
    expect(mockCharge).not.toHaveBeenCalled()
  })

  it("does not charge when tenantId is null", async () => {
    const { middleware, settled } = createBillingMiddleware({
      tenantId: null,
      source: "copilot",
    })
    middleware.onUsage!(ctx, usage({ prompt: 10, completion: 5, cost: 0.0001 }))
    await middleware.onFinish!(ctx, {} as never)
    await settled

    expect(mockCharge).not.toHaveBeenCalled()
  })
})
