// Full-page template — a travel destination landing page. Same authoring
// pattern as about-block: the whole page is one root component whose CSS is
// inlined as a template string (handed to GrapesJS via `defaults.styles`) and
// whose markup is an HTML `components` string.
//
// Every rule uses a single flat class token (no descendant combinators) so the
// Style Manager cascade keeps working, and hover effects ride a CSS-var bridge
// (see `.tc-destination__card:hover` → `--card-lift`). Tokens come from the
// design system (`--tc--preset--*`) with Open Props fallbacks.

import type { Editor } from "grapesjs"

const destinationCss = `
.tc-destination {
  --card-lift: 0;
  font-family: var(--tc--preset--font-family--body, var(--font-sans));
  background-color: var(--tc--preset--color--background, hsl(var(--gray-0-hsl)));
  color: var(--tc--preset--color--foreground, hsl(var(--gray-12-hsl)));
}

/* ── Hero ─────────────────────────────────────────────────────────── */
.tc-destination__hero {
  position: relative;
  display: flex;
  align-items: flex-end;
  min-height: 92svh;
  padding-block: clamp(3rem, 8vw, 7rem);
  padding-inline: clamp(1.25rem, 5vw, 4rem);
  overflow: hidden;
  isolation: isolate;
}

.tc-destination__hero-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -2;
}

.tc-destination__hero-veil {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(
    to top,
    rgba(8, 10, 20, 0.78) 0%,
    rgba(8, 10, 20, 0.32) 45%,
    rgba(8, 10, 20, 0.12) 100%
  );
}

.tc-destination__hero-inner {
  width: 100%;
  max-width: 78rem;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: clamp(0.75rem, 1.6vw, 1.25rem);
  color: hsl(var(--gray-0-hsl));
}

.tc-destination__eyebrow {
  font-size: var(--font-size-0);
  font-weight: var(--font-weight-7);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: hsl(var(--gray-1-hsl));
  margin: 0;
}

.tc-destination__hero-title {
  font-family: var(--tc--preset--font-family--heading, var(--font-sans));
  font-size: clamp(2.5rem, 7vw, 5.5rem);
  line-height: 1.0;
  letter-spacing: -0.025em;
  font-weight: var(--font-weight-9);
  margin: 0;
  max-width: 16ch;
  text-wrap: balance;
}

.tc-destination__hero-lede {
  font-size: clamp(1.0625rem, 1.5vw, 1.3125rem);
  line-height: 1.55;
  max-width: 46ch;
  color: hsl(var(--gray-2-hsl));
  text-wrap: pretty;
  margin: 0;
}

.tc-destination__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--size-3);
  margin-block-start: clamp(0.75rem, 1.6vw, 1.25rem);
}

.tc-destination__cta {
  display: inline-flex;
  align-items: center;
  gap: var(--size-2);
  padding: 0.9rem 1.6rem;
  border: 1px solid transparent;
  border-radius: var(--radius-2, 0.625rem);
  font-weight: var(--font-weight-6);
  font-size: var(--font-size-2);
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color 220ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 220ms cubic-bezier(0.22, 1, 0.36, 1),
    color 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tc-destination__cta:focus-visible {
  outline: 2px solid var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
  outline-offset: 3px;
}

.tc-destination__cta--primary {
  background: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
  color: var(--tc--preset--color--primary-foreground, hsl(var(--gray-0-hsl)));
  border-color: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
}

.tc-destination__cta--primary:hover {
  background: color-mix(in oklch, var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl))) 88%, #000);
}

.tc-destination__cta--ghost {
  background: rgba(255, 255, 255, 0.08);
  color: hsl(var(--gray-0-hsl));
  border-color: rgba(255, 255, 255, 0.45);
}

.tc-destination__cta--ghost:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: hsl(var(--gray-0-hsl));
}

/* ── Highlights ───────────────────────────────────────────────────── */
.tc-destination__highlights {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(1.5rem, 4vw, 3rem);
  max-width: 78rem;
  margin-inline: auto;
  padding-block: clamp(3rem, 6vw, 5rem);
  padding-inline: clamp(1.25rem, 5vw, 4rem);
}

@media (max-width: 760px) {
  .tc-destination__highlights {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}

.tc-destination__highlight {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.tc-destination__highlight-value {
  font-family: var(--tc--preset--font-family--heading, var(--font-sans));
  font-size: clamp(2rem, 3.4vw, 2.75rem);
  font-weight: var(--font-weight-8);
  letter-spacing: -0.02em;
  line-height: 1;
  color: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
}

.tc-destination__highlight-label {
  font-size: var(--font-size-1);
  line-height: 1.5;
  color: var(--tc--preset--color--muted-foreground, hsl(var(--gray-7-hsl)));
}

/* ── Experiences ──────────────────────────────────────────────────── */
.tc-destination__experiences {
  max-width: 78rem;
  margin-inline: auto;
  padding-block: clamp(3rem, 6vw, 6rem);
  padding-inline: clamp(1.25rem, 5vw, 4rem);
}

.tc-destination__section-head {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 40rem;
  margin-block-end: clamp(2rem, 4vw, 3rem);
}

.tc-destination__section-title {
  font-family: var(--tc--preset--font-family--heading, var(--font-sans));
  font-size: clamp(1.875rem, 4vw, 3rem);
  line-height: 1.06;
  letter-spacing: -0.02em;
  font-weight: var(--font-weight-8);
  margin: 0;
  text-wrap: balance;
}

.tc-destination__section-lede {
  font-size: clamp(1rem, 1.3vw, 1.1875rem);
  line-height: 1.6;
  color: var(--tc--preset--color--muted-foreground, hsl(var(--gray-7-hsl)));
  text-wrap: pretty;
  margin: 0;
}

.tc-destination__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(1.25rem, 2.5vw, 2rem);
}

@media (max-width: 900px) {
  .tc-destination__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .tc-destination__grid {
    grid-template-columns: 1fr;
  }
}

.tc-destination__card {
  --card-lift: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius-3, 1rem);
  background: var(--tc--preset--color--card, hsl(var(--gray-0-hsl)));
  border: 1px solid var(--tc--preset--color--border, color-mix(in oklch, hsl(var(--gray-12-hsl)) 10%, transparent));
  transform: translateY(var(--card-lift));
  transition:
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tc-destination__card:hover {
  --card-lift: -6px;
  box-shadow: 0 24px 48px -24px rgba(0, 0, 0, 0.35);
}

.tc-destination__card-media {
  aspect-ratio: 4 / 3;
  overflow: hidden;
}

.tc-destination__card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.tc-destination__card-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: clamp(1.25rem, 2vw, 1.625rem);
}

.tc-destination__card-eyebrow {
  font-size: var(--font-size-0);
  font-weight: var(--font-weight-7);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
}

.tc-destination__card-title {
  font-family: var(--tc--preset--font-family--heading, var(--font-sans));
  font-size: clamp(1.25rem, 1.8vw, 1.5rem);
  font-weight: var(--font-weight-7);
  letter-spacing: -0.01em;
  line-height: 1.2;
  margin: 0;
}

.tc-destination__card-meta {
  font-size: var(--font-size-1);
  color: var(--tc--preset--color--muted-foreground, hsl(var(--gray-7-hsl)));
  margin: 0;
}

/* ── Story ────────────────────────────────────────────────────────── */
.tc-destination__story {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: clamp(2rem, 5vw, 5rem);
  align-items: center;
  max-width: 78rem;
  margin-inline: auto;
  padding-block: clamp(3rem, 6vw, 6rem);
  padding-inline: clamp(1.25rem, 5vw, 4rem);
}

@media (max-width: 880px) {
  .tc-destination__story {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }
}

.tc-destination__story-media {
  aspect-ratio: 5 / 4;
  overflow: hidden;
  border-radius: var(--radius-3, 1rem);
}

.tc-destination__story-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.tc-destination__story-copy {
  display: flex;
  flex-direction: column;
  gap: clamp(0.75rem, 1.5vw, 1.25rem);
  max-width: 34rem;
}

.tc-destination__story-text {
  font-size: clamp(1.0625rem, 1.3vw, 1.1875rem);
  line-height: 1.65;
  color: var(--tc--preset--color--foreground, hsl(var(--gray-9-hsl)));
  text-wrap: pretty;
  margin: 0;
}

/* ── Closing CTA band ─────────────────────────────────────────────── */
.tc-destination__cta-band {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: clamp(1rem, 2vw, 1.5rem);
  padding-block: clamp(4rem, 8vw, 7rem);
  padding-inline: clamp(1.25rem, 5vw, 4rem);
  background: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
  color: var(--tc--preset--color--primary-foreground, hsl(var(--gray-0-hsl)));
}

.tc-destination__cta-title {
  font-family: var(--tc--preset--font-family--heading, var(--font-sans));
  font-size: clamp(2rem, 5vw, 3.75rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-weight: var(--font-weight-9);
  margin: 0;
  max-width: 18ch;
  text-wrap: balance;
}

.tc-destination__cta-lede {
  font-size: clamp(1.0625rem, 1.4vw, 1.25rem);
  line-height: 1.55;
  max-width: 48ch;
  opacity: 0.85;
  margin: 0;
}

.tc-destination__cta-button {
  display: inline-flex;
  align-items: center;
  gap: var(--size-2);
  margin-block-start: 0.5rem;
  padding: 0.95rem 1.75rem;
  border-radius: var(--radius-2, 0.625rem);
  background: var(--tc--preset--color--primary-foreground, hsl(var(--gray-0-hsl)));
  color: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
  font-weight: var(--font-weight-7);
  font-size: var(--font-size-2);
  text-decoration: none;
  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tc-destination__cta-button:hover {
  transform: translateY(-2px);
}

/* ── Footer ───────────────────────────────────────────────────────── */
.tc-destination__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  max-width: 78rem;
  margin-inline: auto;
  padding-block: clamp(2rem, 4vw, 3rem);
  padding-inline: clamp(1.25rem, 5vw, 4rem);
  border-block-start: 1px solid var(--tc--preset--color--border, color-mix(in oklch, hsl(var(--gray-12-hsl)) 10%, transparent));
}

.tc-destination__footer-brand {
  font-family: var(--tc--preset--font-family--heading, var(--font-sans));
  font-size: var(--font-size-2);
  font-weight: var(--font-weight-8);
  letter-spacing: -0.01em;
}

.tc-destination__footer-note {
  font-size: var(--font-size-1);
  color: var(--tc--preset--color--muted-foreground, hsl(var(--gray-7-hsl)));
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  .tc-destination__card,
  .tc-destination__cta,
  .tc-destination__cta-button {
    transition: none;
  }
}
`

const destinationHtml = `
  <section class="tc-destination__hero">
    <img
      class="tc-destination__hero-image"
      alt="A coastal village at golden hour"
      src="https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1920&h=1280&fit=crop"
    />
    <div class="tc-destination__hero-veil"></div>
    <div class="tc-destination__hero-inner">
      <p class="tc-destination__eyebrow">Amalfi Coast &middot; Italy</p>
      <h1 class="tc-destination__hero-title">
        The slow road along the cliffs.
      </h1>
      <p class="tc-destination__hero-lede">
        Lemon groves, hidden coves, and long lunches with no plan after them.
        A week shaped by where the light goes, not where the bus is.
      </p>
      <div class="tc-destination__actions">
        <a href="#" class="tc-destination__cta tc-destination__cta--primary">
          Start planning
        </a>
        <a href="#" class="tc-destination__cta tc-destination__cta--ghost">
          See the itinerary
        </a>
      </div>
    </div>
  </section>

  <section class="tc-destination__highlights">
    <div class="tc-destination__highlight">
      <span class="tc-destination__highlight-value">7 days</span>
      <span class="tc-destination__highlight-label">A relaxed pace, with room to wander off the map.</span>
    </div>
    <div class="tc-destination__highlight">
      <span class="tc-destination__highlight-value">12 stays</span>
      <span class="tc-destination__highlight-label">Family-run rooms and one quiet cliffside hotel.</span>
    </div>
    <div class="tc-destination__highlight">
      <span class="tc-destination__highlight-value">1 host</span>
      <span class="tc-destination__highlight-label">A local who has walked every path you'll take.</span>
    </div>
  </section>

  <section class="tc-destination__experiences">
    <div class="tc-destination__section-head">
      <h2 class="tc-destination__section-title">What fills the days</h2>
      <p class="tc-destination__section-lede">
        Hand-picked detours you won't find pinned on a map &mdash; each one
        chosen because someone who lives here loves it.
      </p>
    </div>
    <div class="tc-destination__grid">
      <article class="tc-destination__card">
        <div class="tc-destination__card-media">
          <img
            class="tc-destination__card-image"
            alt="A boat anchored in a turquoise cove"
            src="https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=900&h=675&fit=crop"
          />
        </div>
        <div class="tc-destination__card-body">
          <span class="tc-destination__card-eyebrow">On the water</span>
          <h3 class="tc-destination__card-title">A morning in the coves</h3>
          <p class="tc-destination__card-meta">Half day &middot; small group</p>
        </div>
      </article>
      <article class="tc-destination__card">
        <div class="tc-destination__card-media">
          <img
            class="tc-destination__card-image"
            alt="A rustic table set with local food"
            src="https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=900&h=675&fit=crop"
          />
        </div>
        <div class="tc-destination__card-body">
          <span class="tc-destination__card-eyebrow">At the table</span>
          <h3 class="tc-destination__card-title">Lunch at the grove</h3>
          <p class="tc-destination__card-meta">3 hours &middot; with the family</p>
        </div>
      </article>
      <article class="tc-destination__card">
        <div class="tc-destination__card-media">
          <img
            class="tc-destination__card-image"
            alt="A stone path winding between cliff houses"
            src="https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=900&h=675&fit=crop"
          />
        </div>
        <div class="tc-destination__card-body">
          <span class="tc-destination__card-eyebrow">On foot</span>
          <h3 class="tc-destination__card-title">The cliffside walk</h3>
          <p class="tc-destination__card-meta">Self-guided &middot; any morning</p>
        </div>
      </article>
    </div>
  </section>

  <section class="tc-destination__story">
    <div class="tc-destination__story-media">
      <img
        class="tc-destination__story-image"
        alt="A host pouring wine on a sunlit terrace"
        src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1000&h=800&fit=crop"
      />
    </div>
    <div class="tc-destination__story-copy">
      <span class="tc-destination__eyebrow" style="color: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)))">Your host</span>
      <h2 class="tc-destination__section-title">Met by someone who lives here</h2>
      <p class="tc-destination__story-text">
        Giulia grew up two villages over. She knows which trattoria opens late,
        which path catches the sunset, and which beach stays empty until noon.
      </p>
      <p class="tc-destination__story-text">
        You'll never touch a queue or a clipboard. Just a number to text when
        plans change &mdash; and they will, because that's the point.
      </p>
    </div>
  </section>

  <section class="tc-destination__cta-band">
    <h2 class="tc-destination__cta-title">Ready when you are.</h2>
    <p class="tc-destination__cta-lede">
      Tell us your dates and the rest takes shape around them. No deposit to
      start the conversation.
    </p>
    <a href="#" class="tc-destination__cta-button">Plan this trip</a>
  </section>

  <footer class="tc-destination__footer">
    <span class="tc-destination__footer-brand">Tripcart</span>
    <p class="tc-destination__footer-note">&copy; Tripcart &middot; Trips designed by people who live there.</p>
  </footer>
`

export const registerDestinationPage = (editor: Editor): void => {
  editor.DomComponents.addType("destination-page", {
    isComponent: (el: HTMLElement) => el.classList?.contains("tc-destination"),

    model: {
      defaults: {
        tagName: "div",
        name: "Destination Page",
        classes: ["tc-destination"],

        // Page roots accept dropped sections so authors can extend them.
        droppable: true,
        draggable: true,
        removable: true,
        copyable: true,

        styles: destinationCss,
        components: destinationHtml,
      },
    },
  })

  editor.Blocks.add("tc-page-destination", {
    label: "Destination Page",
    category: "Sections",
    attributes: { "data-pattern": "true" },
    activate: true,
    resetId: true,
    content: { type: "destination-page" },
    media: `
      <svg viewBox="0 0 60 44" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="58" height="42" rx="3" fill="#1e1e2e"/>
        <rect x="1" y="1" width="58" height="16" rx="3" fill="#3f3f5a"/>
        <rect x="6" y="6"  width="22" height="3" rx="1" fill="#e2e8f0"/>
        <rect x="6" y="11" width="14" height="2" rx="1" fill="#9ca3af"/>
        <rect x="6"  y="21" width="14" height="9" rx="1.5" fill="#6366f1" opacity=".55"/>
        <rect x="23" y="21" width="14" height="9" rx="1.5" fill="#6366f1" opacity=".55"/>
        <rect x="40" y="21" width="14" height="9" rx="1.5" fill="#6366f1" opacity=".55"/>
        <rect x="1" y="34" width="58" height="9" fill="#6366f1"/>
      </svg>
    `,
  })
}
