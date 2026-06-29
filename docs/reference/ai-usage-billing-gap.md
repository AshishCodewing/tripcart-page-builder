# The AI usage billing gap (plain-language)

> A known limitation in how we charge tenants for AI usage, written for anyone —
> not just engineers. The technical home for the ledger itself is
> [`ledger.md`](./ledger.md); this doc is just about the timing problem and our
> options. **Status: documented, not yet addressed.** Today we charge after the
> work is done (see "What we do today").

## The one-sentence version

We only learn the exact cost of an AI request **after** it finishes, so we do
the work first and deduct credits second — and in the small gap between those
two moments, a tenant's balance can run out, leaving us having done work we
can't fully charge for.

## Why this happens (the taxi meter)

Think of an AI request like a taxi ride. You don't know the fare when you get
in — only when you arrive. AI is the same: the cost depends on how much the
model actually does, which we can't know until the request completes.

So the natural flow is:

1. The tenant asks for something.
2. We run the AI request (this is the part that costs us real money).
3. We measure what it actually cost.
4. We deduct that many credits from the tenant's wallet.

The problem is the gap between **step 2** and **step 4**. A tenant can have
several requests running at once. If two big requests happen at nearly the same
time, the first one can use up the credits before the second one gets to
step 4. When the second request tries to charge, the money isn't there anymore.

## What actually goes wrong

Our ledger has a strict, deliberate rule: **a tenant's wallet can never go below
zero.** A tenant can't spend credits they don't have. That rule is correct and
we want it.

But it means the late charge in step 4 gets **refused**. And by then we've
already done the expensive AI work in step 2. So:

- The tenant's balance is still correct (we never let it go negative). ✅
- But we performed work we can't bill for. ❌ That's the gap — a cost we eat.

It's worth being clear about what is and isn't at risk: our **records stay
accurate** no matter what. The only thing exposed is that we might occasionally
do a bit of work for free.

## How big a deal is it?

Usually small. The gap is a fraction of a second, and most requests are cheap.
It matters more when:

- AI requests are **expensive**, so eating even a few hurts, or
- a tenant fires **many requests at once**, which widens the window, or
- a tenant is **right at the edge** of running out of credits.

## Our options (in plain words)

### Option A — Glance before you pour (what we'd do first)

Before starting the work, take a quick look at the tenant's balance. If it's
comfortably above what we expect the request to cost, go ahead; charge the real
amount afterward. Like a bartender glancing at your tab before pouring another
drink.

- **Pros:** simple, nothing new to build, handles the vast majority of cases.
- **Cons:** the glance can be slightly out of date, so a rare edge case can
  still slip through. We keep a safety buffer to shrink that chance.

### Option B — Put a hold on the card (the robust fix)

Before doing the work, set aside an **estimated** amount — like a hotel placing
a temporary hold on your credit card at check-in. Then do the work, charge the
real amount, and release whatever was held but not used.

- **Pros:** the safest — we reject a request we can't afford **before** spending
  any money on it. No free work.
- **Cons:** more to build, and it adds a "held funds" concept to the system.

### Option C — Send a bill later

Let everything run and invoice the tenant afterward, instead of requiring
credits up front. Simplest of all, but it means extending trust/credit to the
tenant and accepting the risk they don't pay.

## Recommendation

Start with **Option A** — it's cheap, ships quickly, and covers almost every
real situation. Move to **Option B** only if AI requests become expensive enough
that the occasional bit of free work actually costs us meaningfully. Don't build
the hold system before we need it.
