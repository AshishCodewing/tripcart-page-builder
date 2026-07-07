import { describe, expect, it } from "vitest"

import {
  DEFAULT_RATE,
  MARKUP_DEN,
  MARKUP_NUM,
  MODEL_RATES,
  unitsToCredits,
  usageToUnits,
} from "@/lib/billing/pricing"

describe("usageToUnits", () => {
  // The worked example from docs/reference/credit-system-model.md: rates
  // $3/Mtok in + $15/Mtok out, 2000 in + 500 out, 2× markup → cost $0.0135,
  // charged $0.027 = 27,000 units = 27 credits. Computed here from first
  // principles with a synthetic rate to stay independent of MODEL_RATES.
  it("matches the credit-system-model.md worked example", () => {
    const inTok = 2000n
    const outTok = 500n
    const rawScaled = inTok * 3_000_000n + outTok * 15_000_000n
    expect(rawScaled).toBe(13_500_000_000n)
    const microUsd = rawScaled / 1_000_000n
    expect(microUsd).toBe(13_500n) // $0.0135
    const units = (rawScaled * 2n) / 1_000_000n
    expect(units).toBe(27_000n) // $0.027 at $1 = 1,000,000 units
    expect(unitsToCredits(units)).toBe(27n)
  })

  it("prices a known model with markup applied", () => {
    const rate = MODEL_RATES["openai/gpt-5.1"]
    const { units, microUsdCost, unknownModel } = usageToUnits({
      model: "openai/gpt-5.1",
      inputTokens: 1_000_000,
      outputTokens: 0,
    })
    expect(unknownModel).toBe(false)
    // 1M input tokens = exactly the per-Mtok rate in micro-USD.
    expect(microUsdCost).toBe(rate.inputMicroUsdPerMtok)
    expect(units).toBe((rate.inputMicroUsdPerMtok * MARKUP_NUM) / MARKUP_DEN)
  })

  it("upholds the $1 = 1,000,000 units invariant", () => {
    // A usage costing exactly $1 must produce exactly 1,000,000 pre-markup
    // units, i.e. 1,000,000 × markup charged units.
    const rate = MODEL_RATES["openai/gpt-5-mini"]
    const tokensForOneDollar =
      (1_000_000n * 1_000_000n) / rate.inputMicroUsdPerMtok
    const { units, microUsdCost } = usageToUnits({
      model: "openai/gpt-5-mini",
      inputTokens: Number(tokensForOneDollar),
      outputTokens: 0,
    })
    expect(microUsdCost).toBe(1_000_000n)
    expect(units).toBe((1_000_000n * MARKUP_NUM) / MARKUP_DEN)
  })

  it("rounds up in the platform's favor", () => {
    // 1 input token on gpt-5-mini: raw = 250,000 → ×2 / 1e6 = 0.5 → ceil 1.
    const { units, microUsdCost } = usageToUnits({
      model: "openai/gpt-5-mini",
      inputTokens: 1,
      outputTokens: 0,
    })
    expect(units).toBe(1n)
    expect(microUsdCost).toBe(1n) // ceil(0.25 µ$)
  })

  it("returns zero units for zero tokens", () => {
    const { units, microUsdCost } = usageToUnits({
      model: "openai/gpt-5-mini",
      inputTokens: 0,
      outputTokens: 0,
    })
    expect(units).toBe(0n)
    expect(microUsdCost).toBe(0n)
  })

  it("falls back to DEFAULT_RATE for unknown models", () => {
    const { units, unknownModel } = usageToUnits({
      model: "some/unlisted-model",
      inputTokens: 1_000_000,
      outputTokens: 0,
    })
    expect(unknownModel).toBe(true)
    expect(units).toBe(
      (DEFAULT_RATE.inputMicroUsdPerMtok * MARKUP_NUM) / MARKUP_DEN
    )
  })

  it("keeps DEFAULT_RATE at least as expensive as every listed model", () => {
    for (const rate of Object.values(MODEL_RATES)) {
      expect(DEFAULT_RATE.inputMicroUsdPerMtok).toBeGreaterThanOrEqual(
        rate.inputMicroUsdPerMtok
      )
      expect(DEFAULT_RATE.outputMicroUsdPerMtok).toBeGreaterThanOrEqual(
        rate.outputMicroUsdPerMtok
      )
    }
  })

  it("clamps negative/fractional token counts instead of throwing", () => {
    const { units } = usageToUnits({
      model: "openai/gpt-5-mini",
      inputTokens: -5,
      outputTokens: 10.7,
    })
    // -5 → 0; 10.7 → 10 output tokens.
    expect(units).toBe(
      (10n *
        MODEL_RATES["openai/gpt-5-mini"].outputMicroUsdPerMtok *
        MARKUP_NUM +
        999_999n) /
        1_000_000n
    )
  })
})

describe("unitsToCredits", () => {
  it("rounds partial credits up (minimum charge 1 credit)", () => {
    expect(unitsToCredits(1n)).toBe(1n)
    expect(unitsToCredits(999n)).toBe(1n)
    expect(unitsToCredits(1000n)).toBe(1n)
    expect(unitsToCredits(1001n)).toBe(2n)
  })

  it("returns 0 for non-positive units", () => {
    expect(unitsToCredits(0n)).toBe(0n)
    expect(unitsToCredits(-5n)).toBe(0n)
  })

  it("converts whole credits exactly", () => {
    expect(unitsToCredits(27_000n)).toBe(27n)
  })
})
