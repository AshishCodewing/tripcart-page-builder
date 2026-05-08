Nepal Social Treks — EBC Landing Page Build Plan
A self-contained spec to feed Claude Code. Builds two pages (USA + EU variants) of the Everest Base Camp Trek landing page from the design brief and screenshot reference.
***1. Project goal & deliverables
Build a high-conversion Google Ads landing page for the Everest Base Camp Trek, embeddable inside the existing nepalsocialtreks.com site. Two near-identical versions: USA and EU. The brief specifies 21 numbered sections plus floating elements; the visual reference confirms layout order, hierarchy, and density.
Deliverables (one folder per market, identical structure):
/ebc-landing-usa/
  index.html        ← single self-contained HTML file with internal <style> and <script>
  /assets/
    /img/           ← placeholder images, structured by section
    /icons/         ← inline SVG sprite or individual SVGs
/ebc-landing-eu/
  index.html
  /assets/...
Hard constraints from the brief:
No external header / footer / nav — these are inherited from the host site.
Sticky mini-nav (Section 1) is internal to the landing page only.
Internal CSS in <style> block in <head> (NOT external stylesheet, NOT inline style="" on elements).
Vanilla JS in a <script> at end of <body>. No build step. No frameworks.
BEM class naming throughout.
CSS custom properties (variables) for every color, font, spacing, radius, shadow, transition.
Mobile-first responsive. Breakpoints: 480, 768, 1024, 1280.
***2. Tech & code conventions
File layout inside index.html
<!doctype html>
<html lang="en">
<head>
  <meta charset>, viewport, SEO meta, Open Graph, JSON-LD schema
  <style>
    /* 1. CSS custom properties (:root)  */
    /* 2. Reset / base                   */
    /* 3. Utilities (.u-container etc.)  */
    /* 4. Components, ordered S1 → S21   */
    /* 5. Floating elements              */
    /* 6. Media queries (mobile-first)   */
  </style>
</head>
<body>
  <!-- S1 ... S21 in order -->
  <!-- Floating elements -->
  <script>
    /* IIFE; one module-style block per behavior */
  </script>
</body>
</html>
CSS variable system (define once in :root)
Pick palette from the screenshot (dark navy hero, primary blue band, amber CTA, white sections, light-gray alternates). Confirm exact hexes against the live site if available, otherwise use these as defaults:
:root {
  /* Brand */
  --color-primary: #1E40AF;          /* deep blue from hero/banner sections */
  --color-primary-dark: #1E3A8A;
  --color-primary-light: #3B82F6;
  --color-accent: #F59E0B;           /* amber CTA */
  --color-accent-dark: #D97706;
  --color-whatsapp: #25D366;
  /* Status */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
  --color-info: #3B82F6;
  /* Neutrals */
  --color-bg: #FFFFFF;
  --color-bg-alt: #F8FAFC;           /* light gray sections */
  --color-bg-dark: #0F172A;          /* video testimonial bg */
  --color-text: #0F172A;
  --color-text-muted: #64748B;
  --color-text-on-dark: #FFFFFF;
  --color-border: #E2E8F0;
  --color-border-strong: #CBD5E1;
  /* Type */
  --font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-display: 'Inter', sans-serif;       /* heavier weights for H1/H2 */
  --fs-xs: 0.75rem;     /* 12 */
  --fs-sm: 0.875rem;    /* 14 */
  --fs-base: 1rem;      /* 16 */
  --fs-md: 1.125rem;    /* 18 */
  --fs-lg: 1.25rem;     /* 20 */
  --fs-xl: 1.5rem;      /* 24 */
  --fs-2xl: 2rem;       /* 32 */
  --fs-3xl: 2.5rem;     /* 40 */
  --fs-4xl: 3rem;       /* 48 — hero H1 desktop */
  /* Spacing scale */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-20: 5rem;
  --space-24: 6rem;
  /* Layout */
  --container-max: 1200px;
  --container-pad: 1.5rem;
  --section-pad-y: 5rem;
  --section-pad-y-mobile: 3rem;
  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-pill: 999px;
  /* Shadow */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 10px 30px rgba(0,0,0,0.12);
  --shadow-nav: 0 2px 20px rgba(0,0,0,0.15);
  /* Motion */
  --ease: cubic-bezier(0.4, 0, 0.2, 1);
  --t-fast: 150ms;
  --t-base: 250ms;
  --t-slow: 400ms;
  /* Z-index */
  --z-nav: 100;
  --z-float: 90;
  --z-modal: 200;
}
JS should reuse these via getComputedStyle(document.documentElement).getPropertyValue('--color-primary') whenever it needs a color value (e.g. for the altitude chart line).
Mobile-first responsive approach
All HTML and CSS is mobile-first. Default styles target the smallest viewport. Use min-width media queries to scale up — never max-width to scale down.
/* Default = mobile (< 480px) */
.hero__headline { font-size: var(--fs-2xl); }       /* 32px */
/* Scale up at breakpoints */
@media (min-width: 768px)  { .hero__headline { font-size: var(--fs-3xl); } }   /* 40px */
@media (min-width: 1024px) { .hero__headline { font-size: var(--fs-4xl); } }   /* 48px */
Breakpoints (used consistently):
| Token | Min-width | Target |
|---|---|---|
| sm | 480px | Large phone |
| md | 768px | Tablet portrait |
| lg | 1024px | Tablet landscape / small laptop |
| xl | 1280px | Desktop |
Layout defaults:
Container padding: var(--container-pad) mobile, var(--space-8) at md+.
Section vertical padding: var(--section-pad-y-mobile) mobile, var(--section-pad-y) at md+.
Multi-column grids: single column by default, grid-template-columns: repeat(2, 1fr) at md, repeat(3, 1fr) or repeat(4, 1fr) at lg.
Two-panel splits (S7, S17): stack vertically by default, side-by-side at md+.
Tables: stacked cards by default, true tables at md+ (see S8).
Touch targets: 44px minimum on all interactive elements.
HTML viewport meta: <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">.
Use clamp() for type that should scale fluidly without breakpoint steps where appropriate, e.g. font-size: clamp(2rem, 5vw + 1rem, 3rem);.
BEM naming
Format: block__element--modifier. One block per section. Examples:
nav-sticky, nav-sticky__logo, nav-sticky__cta, nav-sticky--visible
hero, hero__headline, hero__cta, hero__cta--primary
usp-card, usp-card__icon, usp-card__title
compare-table, compare-table__row, compare-table__cell--featured
itinerary, itinerary__day, itinerary__day--open, itinerary__day-header, itinerary__day-body
faq, faq__tabs, faq__tab, faq__tab--active, faq__panel, faq__item, faq__item--open
departure-card, departure-card__status, departure-card__status--available
float-whatsapp, float-back-to-top, float-back-to-top--visible, exit-popup, exit-popup--open
No utility-first or atomic classes except for a small .u-container, .u-visually-hidden, .u-no-scroll set.
JS structure
Single <script> at end of <body>, one IIFE per behavior, all guarded against missing elements (the page must not throw if a section is removed):
(function() {
  // ---- Sticky nav: show after 100px scroll ----
})();
(function() {
  // ---- Smooth scroll on internal anchor links ----
})();
(function() {
  // ---- Counter count-up via IntersectionObserver ----
})();
(function() {
  // ---- Section fade-in via IntersectionObserver ----
})();
(function() {
  // ---- FAQ tabs (S16) — only the tabs need JS; inner Q&A is native <details> ----
})();
(function() {
  // ---- Testimonial text carousel (S11) ----
})();
(function() {
  // ---- Back-to-top button ----
})();
(function() {
  // ---- WhatsApp tooltip ----
})();
(function() {
  // ---- Exit-intent popup (desktop only) ----
})();
(function() {
  // ---- Altitude chart (S13) — Canvas, no library ----
})();
(function() {
  // ---- Social proof ticker (S3) — pure CSS marquee, JS only for pause-on-hover ----
})();
Use Intersection Observer (not scroll listeners) for animation triggers. Rely on prefers-reduced-motion: reduce to skip count-ups, marquee, and fade-ins.
Accordion implementation pattern (used twice: S9 itinerary, S16 FAQ)
Use the native <details> / <summary> element. No JS for open/close — the browser handles the state, keyboard support (Enter/Space), and aria-expanded for free. JS is only needed for (a) defaulting Day 1 and Day 10 open in S9, (b) defaulting the first Q open in each FAQ tab, and (c) optional smooth-open animation.
<details class="itinerary__day" data-day="1" open>
  <summary class="itinerary__day-header">
    <span class="itinerary__day-num">D01</span>
    <span class="itinerary__day-title">Arrival in Kathmandu</span>
    <span class="itinerary__day-meta">1,400m · Arrival day</span>
    <svg class="itinerary__chevron" aria-hidden="true"></svg>
  </summary>
  <div class="itinerary__day-body">
    ...
  </div>
</details>
Styling notes:
summary { list-style: none; cursor: pointer; } and summary::-webkit-details-marker { display: none; } to hide the default disclosure triangle.
Rotate the custom chevron via details[open] .itinerary__chevron { transform: rotate(180deg); }.
For smooth open/close animation, use the modern interpolate-size: allow-keywords + transition: height approach where supported, with a graceful no-animation fallback. If browser support is a concern, leave it as instant open/close — that's the native default and is perfectly acceptable.
Day 10 highlight: details[data-day="10"] gets the special border/background styling.
Same pattern for S16 FAQ items:
<details class="faq__item" open>
  <summary class="faq__item-header">
    What's included in the $1,430 price?
    <svg class="faq__chevron" aria-hidden="true"></svg>
  </summary>
  <div class="faq__item-body">...</div>
</details>
The FAQ tabs still need JS (tabs are not a native element). Only the inner per-question expand/collapse uses <details>.
***3. Sections — build order and key specs
Build top-to-bottom in the order listed. Each section is a sibling <section> (or <header> / <aside> where semantically right) with a single BEM block.
S1 — Sticky Navigation (nav-sticky)
position: fixed; top: 0; z-index: var(--z-nav);
Hidden by default (translateY(-100%)), JS adds nav-sticky--visible after 100px scroll.
Height 56px by default, 64px at md+.
Background var(--color-primary), shadow var(--shadow-nav).
Default layout: logo + WhatsApp icon + amber CTA only (compact mobile).
At md+: 3-zone flex (left: logo + tagline; center: rating; right: phone + WhatsApp + amber CTA).
S2 — Hero (hero)
Min-height 90vh by default, 100vh at md+.
Background image with linear-gradient(135deg, rgba(30,64,175,0.85) 0%, rgba(0,0,0,0.60) 100%) overlay.
Vertical stack inside container: trust pills row → eyebrow → H1 → sub-headline → quick stats pills → primary + secondary CTA → social proof line.
Bottom: review-platform widget bar with backdrop-filter: blur(8px). Stacks vertically by default, three columns at md+ (TripAdvisor, Google, Trustpilot).
Trust pills: horizontal scroll by default (overflow-x: auto, hide scrollbar), wrap to flex row at md+.
CTAs full-width by default, auto-width side-by-side at md+.
Use placeholder image at assets/img/hero-ebc.webp.
S3 — Social Proof Ticker (ticker)
44px tall, full-width, primary-blue background, white text.
Pure CSS marquee using @keyframes translating the inner track. Duplicate the content list inside the track so the loop is seamless. Pause on hover.
prefers-reduced-motion: reduce → animation paused, content static.
S4 — Why Us / USP Cards (usp)
Centered eyebrow + H2.
Grid: 1fr by default → repeat(2, 1fr) at md → repeat(3, 1fr) at lg.
6 cards with border-top: 4px solid var(--color-primary), padding 32px, radius var(--radius-lg), box-shadow: var(--shadow-md).
64px emoji/icon, H3 title, description.
S5 — Quick Stats Banner (stats-quick)
Full-width, var(--color-primary) bg.
Stat grid: repeat(2, 1fr) by default → repeat(4, 1fr) at md+. Each: huge number (count-up), label, sub-label.
Below: 6 include-icons row, repeat(2, 1fr) by default → repeat(3, 1fr) at md+.
S6 — Trust Signals Triple Panel (trust)
3 cards side by side: TripAdvisor widget placeholder, Google Reviews placeholder, certifications list.
White cards on light-gray section background.
S7 — Included vs Excluded (includes)
Stacks vertically by default; two-column split at md+.
Left/top card: green header bar, list of grouped items with green check icons.
Right/bottom card: red/orange header bar, list with red ✕ icons.
Below: full-width primary-blue banner with WhatsApp + Email CTAs.
S8 — Price Comparison (compare)
This is the conversion-critical table. It needs a real responsive strategy, not just horizontal scroll.
Mobile (<768px): Render as stacked cards, one per competitor. Nepal Social Treks card first and visually featured (amber border, ⭐ BEST badge). Each card lists all criteria as label/value rows. This keeps every comparison readable without horizontal scroll.
Tablet/desktop (≥768px): Render as a true table with all 6 columns visible.
Implementation approach — write the markup as a semantic <table>, then transform with CSS for mobile:
/* Mobile-first: table behaves as stacked cards */
.compare__table,
.compare__table thead,
.compare__table tbody,
.compare__table tr,
.compare__table th,
.compare__table td {
  display: block;
}
.compare__table thead { display: none; }                /* hide header row */
.compare__table tbody { display: grid; gap: var(--space-6); }
.compare__table tr {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  box-shadow: var(--shadow-md);
}
.compare__table td {
  display: grid;
  grid-template-columns: 1fr auto;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}
.compare__table td::before {
  content: attr(data-label);                            /* row label from data-label */
  font-weight: 600;
  color: var(--color-text-muted);
}
/* Desktop: revert to real table */
@media (min-width: 768px) {
  .compare__table,
  .compare__table thead,
  .compare__table tbody,
  .compare__table tr,
  .compare__table th,
  .compare__table td { display: revert; }
  .compare__table { display: table; width: 100%; border-collapse: collapse; }
  .compare__table thead { display: table-header-group; }
  .compare__table tbody { display: table-row-group; }
  .compare__table tr { display: table-row; box-shadow: none; padding: 0; }
  .compare__table td { display: table-cell; }
  .compare__table td::before { content: none; }
  .compare__table__col--featured { background: rgba(245, 158, 11, 0.08); }
}
Markup pattern — every <td> carries a data-label so the mobile cards know what to show:
<table class="compare__table">
  <thead>
    <tr>
      <th>Criteria</th>
      <th class="compare__th--featured">NST ⭐ BEST</th>
      <th>Intrepid</th>
      <th>G Adventures</th>
      <th>Kandoo</th>
      <th>REI</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td data-label="Criteria">💰 Trek Price</td>
      <td data-label="NST" class="compare__td--featured">USD $1,430</td>
      <td data-label="Intrepid">$3,200–$4,500</td>
      ...
    </tr>
  </tbody>
</table>
Note: The mobile-card layout works best when each row is a comparison criterion. To get one card per competitor on mobile (which reads better), pivot the table — make each <tr> a competitor and each <td> a criterion. Pick the orientation that reads best for the audience; the brief's table-as-given uses criteria-as-rows, which is fine for desktop. For mobile, transposing to competitor-as-card is the recommended approach. Implement by writing two versions of the data: a <table> for desktop (criteria rows, hidden below 768px) and a <div class="compare__cards"> of cards for mobile (competitor cards, hidden at and above 768px). Yes, this duplicates content — it's the cleanest readable mobile experience and the duplication is small.
Below table/cards: amber savings callout box.
S9 — 15-Day Itinerary (itinerary)
Vertical timeline column on the left (a :before line on the day-list, with circles per day) on desktop.
Each day card is a native <details> element. Days 1 and 10 ship with the open attribute in HTML. Day 10 styled as the highlight (different border/background to mark "the big day").
Each day card: day-number pill, title, location/altitude/duration meta badges, body description, meal/accommodation icons.
Below: interactive route map embed zone (placeholder div with caption "Interactive Route Map — Google Maps embed").
S10 — Departure Dates (departures)
Anchor: id="departure-dates". All page CTAs link here.
Grid: 1-up by default, 2-up at md+.
Card: left status stripe (color-coded: green/amber/red/blue), date heading, price, spots-remaining, CTA button right-aligned.
Below cards: booking info bullets row, then "BOOKING FORM EMBED ZONE" placeholder.
S11 — Video Testimonials + Carousel (testimonials)
Section bg var(--color-bg-dark), white text.
Default: single-column swipeable scroll (scroll-snap-type: x mandatory). At md+, 3 video cards in a row.
Video card: 16:9 thumbnail with center play button, name/location/flag/rating below, quote, date.
Below: text carousel — 6 quotes auto-rotating every 5s, fade transition. Dot indicators. Pause on hover.
S12 — Meet Your Guides (guides)
1-column grid by default → 3-column at md+.
Card: circular profile photo (placeholder), name, role badge, years exp, born-in location, certifications list, languages.
Below grid: certifications row (5 logos/badges in a flex line, wraps as needed).
S13 — Altitude & Safety (safety)
Light-blue section bg.
Protocol cards: repeat(2, 1fr) by default → repeat(4, 1fr) at md+.
Below: altitude profile chart in a card. Render with Canvas 2D (no Chart.js). X-axis days 1–15, Y-axis 0–5,600m. Line for altitude, dotted line for descent days, two markers for EBC (Day 10) and Kala Patthar (Day 11) with labels. Use --color-primary for the line. Canvas re-renders on resize (debounced 150ms) so it stays sharp at every breakpoint.
Below chart: fitness FAQ as 4 native <details> items. First one ships open. Reuse the styling from S9.
S14 — Photo Gallery (gallery)
Masonry-style grid using CSS columns: column-count: 2 by default, 3 at md, 4 at lg+.
12 photo placeholders. Hover overlay with location name + altitude.
Below grid: "View Full Gallery on Instagram → @nepalsocialtreks" link.
S15 — Company Stats Counters (stats-company)
Primary-blue full-width banner.
Counter grid: repeat(2, 1fr) by default → repeat(4, 1fr) at md+ (so 8 counters land as 4×2 mobile, 4×2 wide on desktop).
Same count-up behavior as S5.
S16 — Full FAQ (faq)
5 tabs at top: Pricing & Booking, The Trek, Preparation, Logistics, Ethics & Sustainability.
ARIA tabs pattern: role="tablist" / role="tab" / role="tabpanel". Arrow keys navigate. JS handles tab switching.
Each panel contains a stack of native <details> Q&A items. First item in each tab ships with the open attribute. Min 44px tap target on <summary>.
S17 — Mid-Page CTA (cta-mid)
Stacks by default (text panel first, photo second). At md+ switches to a 2-column split: left is var(--color-primary) panel with white text + amber CTA; right is the EBC photo.
S18 — Trips You May Also Like (related)
Default: horizontal scroll-snap row. At md: repeat(2, 1fr). At lg+: repeat(4, 1fr) grid.
Card: photo, trek name, duration, price, difficulty badge, description, "View Trek Details" CTA.
S19 — About Nepal Social Treks (about)
Stacks by default; 2-column at md+ (story text left, founder/team photo right).
Below: milestone timeline. Default render is vertical with markers on the left, 10 milestones (2006 → 2026). At lg+ optionally render as a horizontal line with notched markers if it fits cleanly; otherwise stay vertical.
S20 — Final CTA (cta-final)
Full-width Himalayan photo background with var(--color-primary) overlay (~80% opacity).
White text. Headline uses clamp(2rem, 4vw + 1rem, 3rem) for fluid scaling, ExtraBold weight.
CTAs stacked full-width by default; row layout (primary + secondary side by side, tertiary text link below) at md+.
Trust strip below CTAs (single-line bullets, wraps as needed on narrow screens).
S21 — Footer
Per the brief, the existing site footer is reused. Render a placeholder <div class="footer-placeholder"><!-- Existing site footer renders here --></div> styled minimally so the page works standalone for QA.
Floating elements
WhatsApp button (float-whatsapp): Fixed bottom-right. Default 56px circle, 16px from edges. At md+: 64px circle, 80px from bottom / 24px from right. Background var(--color-whatsapp). Tooltip appears on hover (CSS) and after 5s on first page load (JS, dismiss-on-click).
Back to top (float-back-to-top): Above WhatsApp, 48px, primary blue. JS adds --visible after 400px scroll.
Exit-intent popup (exit-popup): Desktop only (gate on matchMedia('(pointer: fine) and (min-width: 1024px)').matches). Listen for mouseout where e.clientY <= 0. Show once per session (sessionStorage). Modal with email input, close X, fine print.
***4. JS behavior specs (exact)
| Behavior | Trigger | Implementation notes |
|---|---|---|
| Sticky nav reveal | scrollY > 100 | toggle nav-sticky--visible. Throttle with requestAnimationFrame. |
| Smooth scroll | Click on a[href^="#"] | e.preventDefault(), target.scrollIntoView({behavior:'smooth', block:'start'}). Account for sticky nav with scroll-margin-top in CSS. |
| Counter count-up | IntersectionObserver, threshold 0.4 | Parse target from data-target, animate from 0 over 1500ms with requestAnimationFrame, ease-out cubic. Skip if prefers-reduced-motion. Run once per element. |
| Section fade-in | IntersectionObserver, threshold 0.1 | Add is-visible class, CSS handles transform/opacity. Skip if prefers-reduced-motion. Unobserve once visible. |
| Itinerary accordion | — | Native <details> / <summary>. Day 1 + Day 10 use open attribute in HTML. No JS. |
| FAQ tabs | Click on .faq__tab | Update --active, show matching panel by id. Arrow key navigation per ARIA tabs pattern. |
| FAQ accordion | — | Native <details> / <summary> per Q&A item. First Q in each tab marked open in HTML. No JS. |
| Testimonial carousel | setInterval 5000ms | Cross-fade between text testimonial slides. Pause on hover. Dot click jumps to slide. Reset interval on manual nav. |
| Back to top | scrollY > 400 | Toggle --visible. On click, smooth scroll to top. |
| Exit-intent | mouseout near top viewport edge | Desktop only, show once per session. Close on X or backdrop click or Esc. |
| Altitude chart | On DOMContentLoaded | Canvas 2D draw. Re-render on resize (debounced 150ms). |
| Ticker pause | mouseenter / mouseleave | Toggle animation-play-state. |
***5. Two-version differences (USA vs EU)
Same HTML structure, different copy. Build USA first, then duplicate the file and swap. The brief's content-switching table is the master list. Key differences:
All headlines, sub-headlines, eyebrow text per the brief.
CTA button labels.
Primary contact ordering (USA: email + phone + WhatsApp equal; EU: WhatsApp first).
Payment method icons order (USA: card + PayPal first; EU: SEPA first).
Testimonial set emphasis (USA: USA/CA/AU quotes; EU: UK/DE/NL/FR quotes) — the carousel keeps both sets but reorders.
Page title, meta description, canonical URL, OG tags.
JSON-LD @id and offer URL.
The brief's content table goes section-by-section; pull from it directly.
***6. Head content (per page)
<title>Everest Base Camp Trek 2026/27 │ 15 Days from $1,430 │ Nepal Social Treks</title>
<meta name="description" content="...">
<link rel="canonical" href="https://nepalsocialtreks.com/everest-base-camp-trek-2026/">
<!-- Open Graph + Twitter Card -->
<!-- Preconnect to fonts and any embed origins -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<!-- JSON-LD: TouristTrip, AggregateRating, FAQPage, Organization -->
<script type="application/ld+json">{...}</script>
JSON-LD must include all four schemas (TouristTrip, AggregateRating, FAQPage, Organization). Wire FAQPage entries directly from the S16 questions so the structured data matches what's on the page.
***7. Performance & a11y checklist (verify on completion)
All <img> below the fold: loading="lazy", explicit width and height, decoding="async".
Hero image: fetchpriority="high", no lazy.
Above-fold critical styles inline (already true since we're using internal CSS — but ensure non-essential rules come after).
<html lang="en">, semantic landmarks, single <h1>, logical heading order.
Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text.
All interactive elements: focus-visible outline (2px solid var(--color-accent)).
All accordions/tabs/popup: ARIA roles + keyboard support.
All icon-only buttons: aria-label.
All form fields: associated <label> (visually hidden where needed).
Modal: trap focus while open, return focus on close, aria-modal="true".
Skip-to-content link at top of <body> (visually hidden, visible on focus).
***8. Build order suggestion
Scaffold index.html with head meta, :root variables, reset, .u-container, and section landmarks (empty <section> per S1–S21).
S2 Hero (sets brand tone — confirms palette and type).
S1 Sticky nav + reveal JS.
S5 stats + counter JS (proves Intersection Observer wiring).
S9 itinerary + accordion JS (proves accordion pattern).
S16 FAQ tabs + accordion (proves tabs pattern).
Sections in order: S3, S4, S6, S7, S8, S10, S11, S12, S13 (with chart), S14, S15, S17, S18, S19, S20, S21.
Floating elements + exit popup.
JSON-LD schemas.
A11y / performance pass.
Duplicate + swap copy for EU version.
***9. Things to ASK the user before building
Brand colors — the brief says "to be confirmed by developer" and points to the live site. If you can fetch / inspect the live site to extract exact hex values, do so; otherwise use the defaults in §2 and flag for review.
Font — Inter is a safe default. Confirm if the live site uses something else (e.g., Poppins, Montserrat).
Real assets — the brief calls for real photos (not stock) for hero, gallery, guides. Use clearly-labeled placeholders (<div class="img-placeholder">Hero photo: EBC prayer flags at golden hour</div> styled to fill the image slot) and list every required asset at the top of index.html in an HTML comment.
Phone/WhatsApp number — placeholder +977-XXX-XXXX in the brief. Use as-is unless real number provided.
Booking form embed — drop-in placeholder zone. Confirm the existing form's embed URL/snippet if available.
If the answer to any of these blocks progress, build with the placeholder and leave a <!-- TODO: --> comment.