// Trip Cards section — three editorial cards (image + eyebrow + title) in a
// responsive grid. Same authoring pattern as hero-block.

import type { Editor } from "grapesjs"

const tripsCss = `
.tc-trips {
  padding-block: clamp(4.5rem, 9vw, 8rem);
  padding-inline: clamp(1.25rem, 5vw, 4rem);
  background-color: var(--background, var(--gray-0));
  color: var(--foreground, var(--gray-12));
  font-family: var(--font-body, var(--font-sans));
}

.tc-trips .tc-trips__inner {
  max-width: 78rem;
  margin-inline: auto;
}

.tc-trips .tc-trips__header {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  align-items: end;
  gap: clamp(1.5rem, 4vw, 3rem);
  margin-block-end: clamp(2rem, 4vw, 3.5rem);
}

@media (max-width: 720px) {
  .tc-trips .tc-trips__header {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

.tc-trips .tc-trips__heading {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.tc-trips .tc-trips__eyebrow {
  font-size: var(--font-size-0);
  font-weight: var(--font-weight-7);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--primary, var(--indigo-6));
  margin: 0;
}

.tc-trips .tc-trips__title {
  font-family: var(--font-heading, var(--font-sans));
  font-size: clamp(1.875rem, 4vw, 3.25rem);
  line-height: 1.05;
  letter-spacing: -0.018em;
  font-weight: var(--font-weight-8);
  margin: 0;
  text-wrap: balance;
}

.tc-trips .tc-trips__title em {
  font-style: italic;
  color: var(--primary, var(--indigo-6));
  font-weight: var(--font-weight-7);
}

.tc-trips .tc-trips__lede {
  font-size: clamp(0.9375rem, 1.2vw, 1.0625rem);
  line-height: 1.55;
  color: var(--foreground, var(--gray-7));
  margin: 0;
  max-width: 32rem;
  justify-self: end;
  text-align: end;
}

@media (max-width: 720px) {
  .tc-trips .tc-trips__lede { justify-self: start; text-align: start; }
}

.tc-trips .tc-trips__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(1rem, 2.4vw, 1.75rem);
}

@media (max-width: 880px) {
  .tc-trips .tc-trips__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 560px) {
  .tc-trips .tc-trips__grid { grid-template-columns: 1fr; }
}

/* ── Card ─────────────────────────────────────────────────────────────── */

.tc-trip-card {
  display: flex;
  flex-direction: column;
  gap: clamp(0.875rem, 1.4vw, 1.125rem);
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tc-trip-card:hover { transform: translateY(-3px); }

.tc-trip-card .tc-trip-card__media {
  position: relative;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  border-radius: var(--radius-3, 1rem);
  background: color-mix(in oklch, var(--foreground, var(--gray-12)) 4%, transparent);
}

.tc-trip-card .tc-trip-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tc-trip-card:hover .tc-trip-card__image { transform: scale(1.04); }

.tc-trip-card .tc-trip-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding-inline: 0.125rem;
}

.tc-trip-card .tc-trip-card__eyebrow {
  font-size: var(--font-size-0, 0.8125rem);
  font-weight: var(--font-weight-6);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--foreground, var(--gray-7));
}

.tc-trip-card .tc-trip-card__title {
  font-family: var(--font-heading, var(--font-sans));
  font-size: clamp(1.125rem, 1.7vw, 1.375rem);
  line-height: 1.2;
  letter-spacing: -0.01em;
  font-weight: var(--font-weight-7);
  color: var(--foreground, var(--gray-12));
  margin: 0;
  text-wrap: balance;
}

@media (prefers-reduced-motion: reduce) {
  .tc-trip-card,
  .tc-trip-card .tc-trip-card__image { transition: none; }
}
`

export const registerTripsBlock = (editor: Editor): void => {
  // Per-card type — each card is a known unit so users can copy / remove
  // them independently. Cards are draggable inside the grid only.

  editor.DomComponents.addType("trip-card", {
    isComponent: (el: HTMLElement) => el.classList?.contains("tc-trip-card"),

    model: {
      defaults: {
        tagName: "a",
        name: "Trip Card",
        attributes: { class: "tc-trip-card", href: "#" },

        draggable: ".tc-trips__grid",
        droppable: false,
        removable: true,
        copyable: true,

        components: `
          <div class="tc-trip-card__media">
            <img
              class="tc-trip-card__image"
              alt=""
              src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=1000&fit=crop"
            />
          </div>
          <div class="tc-trip-card__body">
            <span class="tc-trip-card__eyebrow">Mountains &middot; 7 days</span>
            <h3 class="tc-trip-card__title">Dolomite ridges &amp; quiet alpine villages</h3>
          </div>
        `,
      },
    },
  })

  editor.DomComponents.addType("trips-section", {
    isComponent: (el: HTMLElement) => el.classList?.contains("tc-trips"),

    model: {
      defaults: {
        tagName: "section",
        name: "Trip Cards",
        attributes: { class: "tc-trips" },

        droppable: false,
        draggable: true,
        removable: true,
        copyable: true,

        styles: tripsCss,

        components: [
          {
            tagName: "div",
            attributes: { class: "tc-trips__inner" },
            components: [
              {
                tagName: "div",
                attributes: { class: "tc-trips__header" },
                components: `
                  <div class="tc-trips__heading">
                    <span class="tc-trips__eyebrow">Hand-picked</span>
                    <h2 class="tc-trips__title">
                      Trips worth <em>flying for.</em>
                    </h2>
                  </div>
                  <p class="tc-trips__lede">
                    A small, slow rotation of journeys we'd take ourselves.
                    No schedules, no checklists &mdash; just rooms, tables,
                    and trails worth the detour.
                  </p>
                `,
              },
              {
                tagName: "div",
                attributes: { class: "tc-trips__grid" },
                droppable: '[data-gjs-type="trip-card"]',
                components: [
                  { type: "trip-card" },
                  {
                    type: "trip-card",
                    components: `
                      <div class="tc-trip-card__media">
                        <img
                          class="tc-trip-card__image"
                          alt=""
                          src="https://images.unsplash.com/photo-1480796927426-f609979314bd?w=800&h=1000&fit=crop"
                        />
                      </div>
                      <div class="tc-trip-card__body">
                        <span class="tc-trip-card__eyebrow">City &middot; 5 days</span>
                        <h3 class="tc-trip-card__title">Tokyo backstreets, kissaten by kissaten</h3>
                      </div>
                    `,
                  },
                  {
                    type: "trip-card",
                    components: `
                      <div class="tc-trip-card__media">
                        <img
                          class="tc-trip-card__image"
                          alt=""
                          src="https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?w=800&h=1000&fit=crop"
                        />
                      </div>
                      <div class="tc-trip-card__body">
                        <span class="tc-trip-card__eyebrow">Coast &middot; 9 days</span>
                        <h3 class="tc-trip-card__title">Bali rice terraces &amp; slow-coast mornings</h3>
                      </div>
                    `,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  })

  editor.Blocks.add("tc-trips", {
    label: "Trip Cards",
    category: "Sections",
    attributes: { "data-pattern": "true" },
    activate: true,
    resetId: true,
    content: { type: "trips-section" },
    media: `
      <svg viewBox="0 0 60 44" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="58" height="42" rx="3" fill="#1e1e2e"/>
        <rect x="6"  y="6"  width="20" height="3" rx="1" fill="#e2e8f0"/>
        <rect x="6"  y="11" width="14" height="2" rx="1" fill="#9ca3af"/>
        <rect x="6"  y="18" width="14" height="18" rx="1.5" fill="#3f3f5a"/>
        <rect x="23" y="18" width="14" height="18" rx="1.5" fill="#3f3f5a"/>
        <rect x="40" y="18" width="14" height="18" rx="1.5" fill="#3f3f5a"/>
        <rect x="6"  y="38" width="10" height="2" rx="1" fill="#e2e8f0"/>
        <rect x="23" y="38" width="10" height="2" rx="1" fill="#e2e8f0"/>
        <rect x="40" y="38" width="10" height="2" rx="1" fill="#e2e8f0"/>
      </svg>
    `,
  })
}
