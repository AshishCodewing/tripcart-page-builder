/**
 * Pure token → credit pricing math. No I/O; the only ledger import is the
 * side-effect-free scale constant from `@/lib/ledger/types`.
 *
 * Scale anchors (fixed by docs/reference/credit-system-model.md and
 * lib/ledger/types.ts):
 *
 *   $1 = 1000 credits, 1 credit = 1000 units  ⇒  $1 = 1,000,000 units
 *   ⇒ 1 unit = 1 micro-dollar (pre-markup)
 *
 * Everything is integer `bigint` — rates are stored as micro-dollars per 1M
 * tokens (USD/Mtok × 1e6) so `tokens × rate` stays exact; the single terminal
 * division rounds UP (in the platform's favor).
 */
import { UNITS_PER_CREDIT } from "@/lib/ledger/types"

export interface ModelRate {
  /** micro-USD per 1M input tokens (= USD/Mtok × 1e6) */
  inputMicroUsdPerMtok: bigint
  /** micro-USD per 1M output tokens (= USD/Mtok × 1e6) */
  outputMicroUsdPerMtok: bigint
}

/**
 * Provider rates, keyed by the OpenRouter model id the routes send.
 * CONFIGURABLE — verify against OpenRouter's live pricing before launch and
 * whenever the Langfuse prompt config swaps models.
 */
export const MODEL_RATES: Record<string, ModelRate> = {
  // TODO(pricing): verify against https://openrouter.ai/openai/gpt-5-mini
  "openai/gpt-5-mini": {
    inputMicroUsdPerMtok: 250_000n, // $0.25 / Mtok
    outputMicroUsdPerMtok: 2_000_000n, // $2.00 / Mtok
  },
  // TODO(pricing): verify against https://openrouter.ai/openai/gpt-5.1
  "openai/gpt-5.1": {
    inputMicroUsdPerMtok: 1_250_000n, // $1.25 / Mtok
    outputMicroUsdPerMtok: 10_000_000n, // $10.00 / Mtok
  },
}

/**
 * Fallback for models missing from the table (e.g. a Langfuse config swap we
 * forgot to mirror here). Priced at the most expensive listed model so a gap
 * never undercharges.
 */
export const DEFAULT_RATE: ModelRate = {
  inputMicroUsdPerMtok: 1_250_000n,
  outputMicroUsdPerMtok: 10_000_000n,
}

/** Markup as a ratio: credits charged = provider cost × MARKUP_NUM/MARKUP_DEN. */
// TODO(pricing): 2× taken from credit-system-model.md's example — confirm.
export const MARKUP_NUM = 2n
export const MARKUP_DEN = 1n

const MICRO_PER_MTOK_SCALE = 1_000_000n

/** Integer division rounding up (non-negative operands). */
function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b
}

// Warn once per unknown model per process — a config swap shouldn't spam logs.
const warnedModels = new Set<string>()

/**
 * Convert one request's token usage into ledger units (+ true provider cost
 * in micro-USD for logging/margin). Zero tokens → 0 units (nothing to bill).
 */
export function usageToUnits(p: {
  model: string
  inputTokens: number
  outputTokens: number
}): { units: bigint; microUsdCost: bigint; unknownModel: boolean } {
  const rate = MODEL_RATES[p.model]
  const unknownModel = !rate
  if (unknownModel && !warnedModels.has(p.model)) {
    warnedModels.add(p.model)
    console.warn(
      `[billing] no rate for model "${p.model}" — charging DEFAULT_RATE`
    )
  }
  const { inputMicroUsdPerMtok, outputMicroUsdPerMtok } = rate ?? DEFAULT_RATE

  const inTok = BigInt(Math.max(0, Math.floor(p.inputTokens)))
  const outTok = BigInt(Math.max(0, Math.floor(p.outputTokens)))

  // Scale: micro-USD × 1e6 (rates are per-Mtok). Exact until the final ceil.
  const rawScaled =
    inTok * inputMicroUsdPerMtok + outTok * outputMicroUsdPerMtok
  if (rawScaled === 0n) {
    return { units: 0n, microUsdCost: 0n, unknownModel }
  }

  return {
    units: ceilDiv(rawScaled * MARKUP_NUM, MICRO_PER_MTOK_SCALE * MARKUP_DEN),
    microUsdCost: ceilDiv(rawScaled, MICRO_PER_MTOK_SCALE),
    unknownModel,
  }
}

/**
 * Units → whole credits for the ledger (LedgerFactory takes whole credits).
 * Rounds up with a 1-credit minimum for any positive amount, so a metered
 * request is never free; max overcharge is <1 credit (<$0.001).
 */
export function unitsToCredits(units: bigint): bigint {
  if (units <= 0n) return 0n
  const credits = ceilDiv(units, UNITS_PER_CREDIT)
  return credits > 0n ? credits : 1n
}
