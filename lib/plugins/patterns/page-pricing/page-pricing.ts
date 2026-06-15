// Full-page template — a pricing / plans page. Same authoring pattern as
// about-block and page-destination: one root component, CSS inlined as a
// template string, markup as an HTML `components` string.
//
// Flat single-class selectors only (no descendant combinators) so the Style
// Manager cascade survives; the featured plan uses a `--featured` modifier
// rather than a descendant rule, and the FAQ uses native <details>/<summary>.
// Tokens are `--tc--preset--*` with Open Props fallbacks.

import type { Editor } from "grapesjs"
import { pricingPageDescriptor } from "@/lib/plugins/patterns/manifest"

const pricingCss = `
.tc-pricing {
  font-family: var(--tc--preset--font-family--body, var(--font-sans));
  background-color: var(--tc--preset--color--background, hsl(var(--gray-0-hsl)));
  color: var(--tc--preset--color--foreground, hsl(var(--gray-12-hsl)));
}

/* ── Hero ─────────────────────────────────────────────────────────── */
.tc-pricing__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: clamp(0.75rem, 1.6vw, 1.25rem);
  max-width: 52rem;
  margin-inline: auto;
  padding-block: clamp(4rem, 9vw, 7rem) clamp(2rem, 4vw, 3rem);
  padding-inline: clamp(1.25rem, 5vw, 4rem);
}

.tc-pricing__eyebrow {
  font-size: var(--font-size-0);
  font-weight: var(--font-weight-7);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
  margin: 0;
}

.tc-pricing__title {
  font-family: var(--tc--preset--font-family--heading, var(--font-sans));
  font-size: clamp(2.25rem, 5.5vw, 4rem);
  line-height: 1.04;
  letter-spacing: -0.025em;
  font-weight: var(--font-weight-9);
  margin: 0;
  max-width: 18ch;
  text-wrap: balance;
}

.tc-pricing__lede {
  font-size: clamp(1.0625rem, 1.4vw, 1.25rem);
  line-height: 1.6;
  max-width: 44ch;
  color: var(--tc--preset--color--muted-foreground, hsl(var(--gray-7-hsl)));
  text-wrap: pretty;
  margin: 0;
}

.tc-pricing__toggle {
  display: inline-flex;
  gap: 0.25rem;
  margin-block-start: clamp(0.75rem, 1.6vw, 1.25rem);
  padding: 0.3rem;
  border-radius: var(--radius-round, 999px);
  background: var(--tc--preset--color--secondary, hsl(var(--gray-2-hsl)));
}

.tc-pricing__toggle-option {
  border: 0;
  cursor: pointer;
  padding: 0.55rem 1.1rem;
  border-radius: var(--radius-round, 999px);
  font-size: var(--font-size-1);
  font-weight: var(--font-weight-6);
  font-family: inherit;
  color: var(--tc--preset--color--muted-foreground, hsl(var(--gray-7-hsl)));
  background: transparent;
}

.tc-pricing__toggle-option--active {
  background: var(--tc--preset--color--background, hsl(var(--gray-0-hsl)));
  color: var(--tc--preset--color--foreground, hsl(var(--gray-12-hsl)));
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

/* ── Plans ────────────────────────────────────────────────────────── */
.tc-pricing__plans {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(1.25rem, 2.5vw, 2rem);
  align-items: start;
  max-width: 72rem;
  margin-inline: auto;
  padding-block: clamp(2rem, 4vw, 3rem) clamp(3rem, 6vw, 5rem);
  padding-inline: clamp(1.25rem, 5vw, 4rem);
}

@media (max-width: 880px) {
  .tc-pricing__plans {
    grid-template-columns: 1fr;
    max-width: 30rem;
  }
}

.tc-pricing__plan {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: clamp(1.5rem, 3vw, 2.25rem);
  border-radius: var(--radius-3, 1rem);
  background: var(--tc--preset--color--card, hsl(var(--gray-0-hsl)));
  border: 1px solid var(--tc--preset--color--border, color-mix(in oklch, hsl(var(--gray-12-hsl)) 12%, transparent));
}

.tc-pricing__plan--featured {
  background: var(--tc--preset--color--foreground, hsl(var(--gray-12-hsl)));
  color: var(--tc--preset--color--background, hsl(var(--gray-0-hsl)));
  border-color: transparent;
  box-shadow: 0 32px 64px -32px rgba(0, 0, 0, 0.45);
}

.tc-pricing__plan-badge {
  align-self: flex-start;
  padding: 0.25rem 0.7rem;
  border-radius: var(--radius-round, 999px);
  font-size: var(--font-size-0);
  font-weight: var(--font-weight-7);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
  color: var(--tc--preset--color--primary-foreground, hsl(var(--gray-0-hsl)));
}

.tc-pricing__plan-name {
  font-family: var(--tc--preset--font-family--heading, var(--font-sans));
  font-size: clamp(1.25rem, 1.8vw, 1.5rem);
  font-weight: var(--font-weight-7);
  letter-spacing: -0.01em;
  margin: 0;
}

.tc-pricing__plan-price {
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
}

.tc-pricing__plan-amount {
  font-family: var(--tc--preset--font-family--heading, var(--font-sans));
  font-size: clamp(2.5rem, 4vw, 3.25rem);
  font-weight: var(--font-weight-9);
  letter-spacing: -0.03em;
  line-height: 1;
}

.tc-pricing__plan-period {
  font-size: var(--font-size-1);
  opacity: 0.7;
}

.tc-pricing__plan-summary {
  font-size: var(--font-size-1);
  line-height: 1.55;
  opacity: 0.8;
  margin: 0;
}

.tc-pricing__features {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.tc-pricing__feature {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  font-size: var(--font-size-1);
  line-height: 1.45;
}

.tc-pricing__feature-mark {
  flex: none;
  margin-block-start: 0.15em;
  color: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
  font-weight: var(--font-weight-8);
}

.tc-pricing__plan-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-block-start: auto;
  padding: 0.85rem 1.25rem;
  border: 1px solid var(--tc--preset--color--border, color-mix(in oklch, hsl(var(--gray-12-hsl)) 16%, transparent));
  border-radius: var(--radius-2, 0.625rem);
  background: transparent;
  color: inherit;
  font-weight: var(--font-weight-6);
  font-size: var(--font-size-2);
  text-decoration: none;
  transition: background-color 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tc-pricing__plan-cta:hover {
  background: color-mix(in oklch, currentColor 8%, transparent);
}

.tc-pricing__plan-cta--primary {
  background: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
  color: var(--tc--preset--color--primary-foreground, hsl(var(--gray-0-hsl)));
  border-color: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
}

.tc-pricing__plan-cta--primary:hover {
  background: color-mix(in oklch, var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl))) 88%, #000);
}

/* ── FAQ ──────────────────────────────────────────────────────────── */
.tc-pricing__faq {
  max-width: 48rem;
  margin-inline: auto;
  padding-block: clamp(3rem, 6vw, 5rem);
  padding-inline: clamp(1.25rem, 5vw, 4rem);
}

.tc-pricing__faq-title {
  font-family: var(--tc--preset--font-family--heading, var(--font-sans));
  font-size: clamp(1.75rem, 3.4vw, 2.5rem);
  line-height: 1.1;
  letter-spacing: -0.02em;
  font-weight: var(--font-weight-8);
  text-align: center;
  margin: 0 0 clamp(1.5rem, 3vw, 2.5rem);
  text-wrap: balance;
}

.tc-pricing__faq-item {
  border-block-end: 1px solid var(--tc--preset--color--border, color-mix(in oklch, hsl(var(--gray-12-hsl)) 10%, transparent));
}

.tc-pricing__faq-question {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  list-style: none;
  padding-block: clamp(1rem, 2vw, 1.375rem);
  font-family: var(--tc--preset--font-family--heading, var(--font-sans));
  font-size: clamp(1.0625rem, 1.4vw, 1.1875rem);
  font-weight: var(--font-weight-6);
}

.tc-pricing__faq-question::-webkit-details-marker {
  display: none;
}

.tc-pricing__faq-question::after {
  content: "+";
  font-size: 1.4em;
  font-weight: var(--font-weight-5);
  color: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
  transition: transform 200ms ease;
}

.tc-pricing__faq-answer {
  padding-block-end: clamp(1rem, 2vw, 1.375rem);
  font-size: var(--font-size-1);
  line-height: 1.65;
  color: var(--tc--preset--color--muted-foreground, hsl(var(--gray-7-hsl)));
  max-width: 60ch;
  margin: 0;
}

/* ── Closing CTA band ─────────────────────────────────────────────── */
.tc-pricing__cta-band {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: clamp(1rem, 2vw, 1.5rem);
  margin: clamp(2rem, 4vw, 4rem) clamp(1.25rem, 5vw, 4rem);
  padding-block: clamp(3rem, 6vw, 5rem);
  padding-inline: clamp(1.25rem, 5vw, 4rem);
  border-radius: var(--radius-4, 1.5rem);
  background: var(--tc--preset--color--secondary, hsl(var(--gray-2-hsl)));
}

.tc-pricing__cta-title {
  font-family: var(--tc--preset--font-family--heading, var(--font-sans));
  font-size: clamp(1.75rem, 4vw, 3rem);
  line-height: 1.06;
  letter-spacing: -0.02em;
  font-weight: var(--font-weight-9);
  margin: 0;
  max-width: 20ch;
  text-wrap: balance;
}

.tc-pricing__cta-lede {
  font-size: clamp(1rem, 1.3vw, 1.1875rem);
  line-height: 1.55;
  max-width: 46ch;
  color: var(--tc--preset--color--muted-foreground, hsl(var(--gray-7-hsl)));
  margin: 0;
}

.tc-pricing__cta-button {
  display: inline-flex;
  align-items: center;
  gap: var(--size-2);
  margin-block-start: 0.5rem;
  padding: 0.95rem 1.75rem;
  border-radius: var(--radius-2, 0.625rem);
  background: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
  color: var(--tc--preset--color--primary-foreground, hsl(var(--gray-0-hsl)));
  font-weight: var(--font-weight-7);
  font-size: var(--font-size-2);
  text-decoration: none;
  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tc-pricing__cta-button:hover {
  transform: translateY(-2px);
}

@media (prefers-reduced-motion: reduce) {
  .tc-pricing__plan-cta,
  .tc-pricing__cta-button,
  .tc-pricing__faq-question::after {
    transition: none;
  }
}
`

const pricingHtml = `
  <section class="tc-pricing__hero">
    <p class="tc-pricing__eyebrow">Pricing</p>
    <h1 class="tc-pricing__title">Plans that scale with the journey.</h1>
    <p class="tc-pricing__lede">
      Start free, upgrade when the trips get bigger. Every plan includes the
      builder, hosting, and a real human on the other end.
    </p>
    <div class="tc-pricing__toggle">
      <button type="button" class="tc-pricing__toggle-option tc-pricing__toggle-option--active">Monthly</button>
      <button type="button" class="tc-pricing__toggle-option">Yearly &middot; save 20%</button>
    </div>
  </section>

  <section class="tc-pricing__plans">
    <article class="tc-pricing__plan">
      <h2 class="tc-pricing__plan-name">Solo</h2>
      <div class="tc-pricing__plan-price">
        <span class="tc-pricing__plan-amount">$0</span>
        <span class="tc-pricing__plan-period">/ month</span>
      </div>
      <p class="tc-pricing__plan-summary">For planning your first trip and finding your feet.</p>
      <ul class="tc-pricing__features">
        <li class="tc-pricing__feature"><span class="tc-pricing__feature-mark">&checkmark;</span>1 published page</li>
        <li class="tc-pricing__feature"><span class="tc-pricing__feature-mark">&checkmark;</span>Core block library</li>
        <li class="tc-pricing__feature"><span class="tc-pricing__feature-mark">&checkmark;</span>Tripcart subdomain</li>
        <li class="tc-pricing__feature"><span class="tc-pricing__feature-mark">&checkmark;</span>Community support</li>
      </ul>
      <a href="#" class="tc-pricing__plan-cta">Get started</a>
    </article>

    <article class="tc-pricing__plan tc-pricing__plan--featured">
      <span class="tc-pricing__plan-badge">Most popular</span>
      <h2 class="tc-pricing__plan-name">Studio</h2>
      <div class="tc-pricing__plan-price">
        <span class="tc-pricing__plan-amount">$24</span>
        <span class="tc-pricing__plan-period">/ month</span>
      </div>
      <p class="tc-pricing__plan-summary">For hosts running a handful of trips a season.</p>
      <ul class="tc-pricing__features">
        <li class="tc-pricing__feature"><span class="tc-pricing__feature-mark">&checkmark;</span>Unlimited pages</li>
        <li class="tc-pricing__feature"><span class="tc-pricing__feature-mark">&checkmark;</span>Custom domain</li>
        <li class="tc-pricing__feature"><span class="tc-pricing__feature-mark">&checkmark;</span>Theme &amp; brand controls</li>
        <li class="tc-pricing__feature"><span class="tc-pricing__feature-mark">&checkmark;</span>Saved patterns &amp; parts</li>
        <li class="tc-pricing__feature"><span class="tc-pricing__feature-mark">&checkmark;</span>Priority support</li>
      </ul>
      <a href="#" class="tc-pricing__plan-cta tc-pricing__plan-cta--primary">Start free trial</a>
    </article>

    <article class="tc-pricing__plan">
      <h2 class="tc-pricing__plan-name">Agency</h2>
      <div class="tc-pricing__plan-price">
        <span class="tc-pricing__plan-amount">$79</span>
        <span class="tc-pricing__plan-period">/ month</span>
      </div>
      <p class="tc-pricing__plan-summary">For teams managing trips across many destinations.</p>
      <ul class="tc-pricing__features">
        <li class="tc-pricing__feature"><span class="tc-pricing__feature-mark">&checkmark;</span>Everything in Studio</li>
        <li class="tc-pricing__feature"><span class="tc-pricing__feature-mark">&checkmark;</span>Multi-tenant workspaces</li>
        <li class="tc-pricing__feature"><span class="tc-pricing__feature-mark">&checkmark;</span>Roles &amp; permissions</li>
        <li class="tc-pricing__feature"><span class="tc-pricing__feature-mark">&checkmark;</span>Dedicated success manager</li>
      </ul>
      <a href="#" class="tc-pricing__plan-cta">Talk to sales</a>
    </article>
  </section>

  <section class="tc-pricing__faq">
    <h2 class="tc-pricing__faq-title">Questions, answered</h2>

    <details class="tc-pricing__faq-item">
      <summary class="tc-pricing__faq-question">Can I switch plans later?</summary>
      <p class="tc-pricing__faq-answer">
        Anytime. Upgrades take effect immediately and we prorate the
        difference; downgrades apply at the start of your next cycle.
      </p>
    </details>

    <details class="tc-pricing__faq-item">
      <summary class="tc-pricing__faq-question">Is there a free trial?</summary>
      <p class="tc-pricing__faq-answer">
        Studio and Agency both come with a 14-day trial &mdash; no card
        required until you decide to keep going.
      </p>
    </details>

    <details class="tc-pricing__faq-item">
      <summary class="tc-pricing__faq-question">What happens to my pages if I cancel?</summary>
      <p class="tc-pricing__faq-answer">
        They stay safe and editable on the free Solo plan. You only lose the
        paid features, never your work.
      </p>
    </details>

    <details class="tc-pricing__faq-item">
      <summary class="tc-pricing__faq-question">Do you offer discounts for non-profits?</summary>
      <p class="tc-pricing__faq-answer">
        Yes &mdash; reach out and we'll sort you out with a reduced rate on any
        paid plan.
      </p>
    </details>
  </section>

  <section class="tc-pricing__cta-band">
    <h2 class="tc-pricing__cta-title">Still weighing it up?</h2>
    <p class="tc-pricing__cta-lede">
      Start on the free plan and build your first page today. Upgrade the day
      it earns its keep.
    </p>
    <a href="#" class="tc-pricing__cta-button">Build for free</a>
  </section>
`

export const registerPricingPage = (editor: Editor): void => {
  editor.DomComponents.addType("pricing-page", {
    isComponent: (el: HTMLElement) => el.classList?.contains("tc-pricing"),

    model: {
      defaults: {
        tagName: "div",
        name: "Pricing Page",
        classes: ["tc-pricing"],

        // Page roots accept dropped sections so authors can extend them.
        droppable: true,
        draggable: true,
        removable: true,
        copyable: true,

        styles: pricingCss,
        components: pricingHtml,
      },
    },
  })

  editor.Blocks.add(pricingPageDescriptor.id, {
    label: pricingPageDescriptor.label,
    category: pricingPageDescriptor.category,
    attributes: { "data-pattern": "true" },
    activate: true,
    resetId: true,
    content: { type: "pricing-page" },
    media: `
      <svg viewBox="0 0 60 44" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="58" height="42" rx="3" fill="#1e1e2e"/>
        <rect x="20" y="6" width="20" height="4" rx="1" fill="#e2e8f0"/>
        <rect x="6"  y="16" width="14" height="22" rx="2" fill="#3f3f5a"/>
        <rect x="23" y="13" width="14" height="28" rx="2" fill="#6366f1"/>
        <rect x="40" y="16" width="14" height="22" rx="2" fill="#3f3f5a"/>
        <rect x="26" y="18" width="8" height="3" rx="1" fill="#ffffff"/>
        <rect x="26" y="24" width="8" height="2" rx="1" fill="#ffffff" opacity=".6"/>
      </svg>
    `,
  })
}
