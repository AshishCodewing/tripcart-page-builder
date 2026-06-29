# How the credit system works (the business model)

> Conceptual reference for how credits, dollars, and AI tokens relate — and how
> a tenant's usage turns into a credit deduction. Written for anyone, not just
> engineers. The ledger that records credit movements is documented in
> [`ledger.md`](./ledger.md); the AI-charging timing caveat is in
> [`ai-usage-billing-gap.md`](./ai-usage-billing-gap.md).
>
> **Scope note:** everything here above the word "credits" — dollar rates,
> markup, provider-cost tracking — is the **business layer that sits on top of
> the ledger** and is **not built yet** (deliberately deferred). This doc pins
> down the model so it's built consistently.

## The big picture: two money flows, credits in the middle

```
   TENANTS                    US (platform)                  AI PROVIDERS
      │                            │                          (OpenAI/Claude)
      │  pay $ (subscription) ───▶ │                               │
      │  ◀─── get credits          │                               │
      │                            │                               │
      │  use a feature ──────────▶ │ ── call the API ────────────▶ │
      │                            │ ◀── tokens used + we pay $ ─── │
      │  ◀─ credits deducted       │                               │
```

There are two separate money flows:

- **Money in:** tenants pay us (subscriptions or top-ups) and receive credits.
- **Money out:** we pay AI providers for the tokens their models consume.

**Credits are the abstraction layer between the two.** They are neither dollars
nor tokens — they are our own unit, and the conversions into and out of credits
are where our pricing and profit live.

## Why credits exist (instead of billing dollars directly)

1. **They decouple our prices from the providers'.** Providers change prices,
   and every model costs differently. Credits give tenants one stable unit while
   we absorb that complexity.
2. **Prepaid = cash up front + capped exposure.** Tenants buy credits before
   using them, so we get cash early and a tenant can never run up an unlimited
   surprise bill — they can only spend what they hold. (This is the ledger's
   "wallet can never go negative" rule.)
3. **Simpler for the tenant.** "This costs 5 credits" beats "2,143 input tokens
   at $3/M plus 562 output tokens at $15/M."
4. **Our margin hides inside the conversion.** We decide how many credits a
   dollar of provider cost becomes. That markup is our revenue.

## The three layers (don't conflate them)

| Layer | Unit | Conversion | Lives where |
|---|---|---|---|
| Money | **dollars** | `$1 = 1000 credits` (our rate) | subscription / purchase layer |
| Tenant-facing | **credits** | `1 credit = 1000 units` (internal precision) | the ledger's edge |
| Internal storage | **units** | — | the ledger (stored as `bigint`) |

Full chain: **`$1 = 1,000 credits = 1,000,000 units`**.

> ⚠️ Two unrelated "1000×" factors both appear here and are easy to confuse:
> `$1 = 1000 credits` is our **money rate** (business layer); `1 credit = 1000
> units` is the ledger's **internal sub-credit precision**. Mixing them up means
> being wrong by 1000×. The ledger only ever sees credits (at its edge) and
> units (inside) — it never stores dollars.

## The deduction chain (token usage → credits charged)

How a tenant's usage becomes a credit deduction, with realistic numbers.
Assume a model priced at **$3 per million input tokens / $15 per million
output**, and a request that used **2,000 input + 500 output tokens**.

**Step 1 — The provider reports usage.** Every API response includes the tokens
used (input + output, per model).

**Step 2 — Compute our real dollar cost.**

```
input:   2,000 / 1,000,000 × $3   = $0.006
output:    500 / 1,000,000 × $15  = $0.0075
                            total  = $0.0135   ← what we owe the provider
```

**Step 3 — Convert to credits, with markup.** At `$1 = 1000 credits`, 1 credit
= $0.001, so the raw cost is 13.5 credits. We don't charge cost — we add markup.
At **2× markup we charge 27 credits**.

**Step 4 — Deduct from the wallet.** Post an `AI_USAGE` transaction for 27
credits: `TENANT_WALLET −27`, `AI_CONSUMED +27`.

**Margin on this one call:**

```
tenant paid us (in credits worth)   $0.027
we paid the provider                $0.0135
gross margin                        $0.0135    (we doubled our money)
```

Across millions of calls, that gap is the business.

## A pricing choice: actual cost vs. fixed price per action

Step 3 has two common styles:

- **Cost-plus (variable):** charge actual tokens × markup. Accurate; margin
  guaranteed per call. But the tenant can't predict what an action will cost.
- **Fixed per action:** "summarizing a page = 5 credits," regardless of actual
  tokens. Predictable and friendly — but **we** carry the variance (eat the
  difference when a request runs long, keep it when it runs short). The fixed
  price is set from average observed cost plus margin.

Most polished products use **fixed per-action pricing** for predictability and
absorb the variance. It also sidesteps the timing problem in
[`ai-usage-billing-gap.md`](./ai-usage-billing-gap.md), since the price is known
before the work starts.

## The full credit lifecycle (and the ledger piece for each)

```
GRANT     subscription renews   → CREDIT_ISSUANCE → wallet   (createSubscriptionGrant)
PURCHASE  tenant buys a top-up  → CREDIT_ISSUANCE → wallet   (createCreditPurchase)
CONSUME   tenant uses a feature → wallet → AI_CONSUMED       (createAIUsage)   ← the deduction
EXPIRE    unused credits lapse  → wallet → CREDIT_EXPIRED    (createExpiration)
REFUND    we reverse a charge   → AI_CONSUMED → wallet       (createRefund)
```

Every one of these already exists as a factory builder in the ledger. The ledger
is the **accounting truth for credits**: how many a tenant holds, and where
every credit went.

## Two ledgers, not one: revenue vs. cost (margin)

This is the subtle part. The credit ledger tracks **credits** — the
tenant-facing, **revenue** side. It does **not** track the **dollars we actually
paid the provider** — the **cost** side. Those are two different records:

- **Credit consumption** → `AI_CONSUMED` (what we charged tenants, in credits).
- **Provider cost** → our monthly bill from OpenAI/Anthropic (real dollars out).

To know our **margin**, we record the provider's actual dollar cost per request
*alongside* the usage — a cost log next to the ledger (the deferred `ai_usage`
table). Periodically we **reconcile**: the provider costs we attributed to
requests should roughly match the actual bill the provider sends us. If they
drift apart, something is being mismetered.

## Takeaways

1. **Credits ≠ dollars ≠ tokens.** They're a deliberate middle layer, and the
   conversions between them (token→$, $→credits, +markup) are where pricing and
   profit live — none of it inside the ledger.
2. **Two ledgers:** credits (revenue, built) and provider dollars (cost, not
   built). Margin is the gap between them.
3. **The dollar↔credit rate (`$1 = 1000 credits`) and markup belong in the
   business layer**, applied at grant/purchase/usage time — not in the ledger.
