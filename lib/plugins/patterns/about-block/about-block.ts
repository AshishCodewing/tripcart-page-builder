// About Us section — editorial two-column layout with a stat badge overlaid
// on the media column. Same authoring pattern as hero-block: CSS is inlined
// as a template string and handed to GrapesJS via `defaults.styles`.

import type { Editor } from "grapesjs"

const aboutCss = `
.tc-about {
  padding-block: clamp(4.5rem, 9vw, 8rem);
  padding-inline: clamp(1.25rem, 5vw, 4rem);
  background-color: var(--background, var(--gray-0));
  color: var(--foreground, var(--gray-12));
  font-family: var(--font-body, var(--font-sans));
}

.tc-about .tc-about__inner {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: clamp(2rem, 5vw, 5rem);
  align-items: center;
  max-width: 78rem;
  margin-inline: auto;
}

@media (max-width: 880px) {
  .tc-about .tc-about__inner {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }
}

.tc-about .tc-about__copy {
  display: flex;
  flex-direction: column;
  gap: clamp(0.75rem, 1.5vw, 1.25rem);
  max-width: 36rem;
}

.tc-about .tc-about__eyebrow {
  font-family: var(--font-body, var(--font-sans));
  font-size: var(--font-size-0);
  font-weight: var(--font-weight-7);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--primary, var(--indigo-6));
  margin: 0;
}

.tc-about .tc-about__title {
  font-family: var(--font-heading, var(--font-sans));
  font-size: clamp(2rem, 4.4vw, 3.75rem);
  line-height: 1.04;
  letter-spacing: -0.02em;
  font-weight: var(--font-weight-8);
  margin: 0;
  text-wrap: balance;
}

.tc-about .tc-about__title em {
  font-style: italic;
  color: var(--primary, var(--indigo-6));
  font-weight: var(--font-weight-7);
}

.tc-about .tc-about__lede {
  font-size: clamp(1.0625rem, 1.3vw, 1.1875rem);
  line-height: 1.6;
  color: var(--foreground, var(--gray-7));
  text-wrap: pretty;
  margin: 0;
}

.tc-about .tc-about__meta {
  display: flex;
  flex-wrap: wrap;
  gap: clamp(1.25rem, 3vw, 2rem);
  margin-block-start: clamp(1rem, 2vw, 1.5rem);
  padding-block-start: clamp(1rem, 2vw, 1.5rem);
  border-block-start: 1px solid var(--border, color-mix(in oklch, var(--gray-12) 12%, transparent));
}

.tc-about .tc-about__meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.tc-about .tc-about__meta-value {
  font-family: var(--font-heading, var(--font-sans));
  font-size: clamp(1.5rem, 2.4vw, 1.875rem);
  font-weight: var(--font-weight-8);
  letter-spacing: -0.01em;
  line-height: 1;
  color: var(--foreground, var(--gray-12));
}

.tc-about .tc-about__meta-label {
  font-size: var(--font-size-0);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--foreground, var(--gray-7));
}

.tc-about .tc-about__media {
  position: relative;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  border-radius: var(--radius-3, 1rem);
  background: color-mix(in oklch, var(--foreground, var(--gray-12)) 4%, transparent);
}

.tc-about .tc-about__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 800ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tc-about:hover .tc-about__image {
  transform: scale(1.025);
}

.tc-about .tc-about__badge {
  position: absolute;
  inset-inline-start: clamp(0.875rem, 2vw, 1.5rem);
  inset-block-end: clamp(0.875rem, 2vw, 1.5rem);
  padding: clamp(0.875rem, 1.4vw, 1.125rem) clamp(1rem, 1.6vw, 1.375rem);
  background: var(--background, var(--gray-0));
  color: var(--foreground, var(--gray-12));
  border-radius: var(--radius-2, 0.625rem);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 24px 48px -16px rgba(0, 0, 0, 0.18);
  display: flex;
  align-items: baseline;
  gap: 0.625rem;
  max-width: calc(100% - 2rem);
}

.tc-about .tc-about__badge-value {
  font-family: var(--font-heading, var(--font-sans));
  font-size: clamp(1.375rem, 2.2vw, 1.75rem);
  font-weight: var(--font-weight-9);
  letter-spacing: -0.015em;
  line-height: 1;
  color: var(--primary, var(--indigo-6));
}

.tc-about .tc-about__badge-label {
  font-size: var(--font-size-0);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--foreground, var(--gray-7));
}

@media (prefers-reduced-motion: reduce) {
  .tc-about .tc-about__image { transition: none; }
}
`

export const registerAboutBlock = (editor: Editor): void => {
  editor.DomComponents.addType("about-section", {
    isComponent: (el: HTMLElement) => el.classList?.contains("tc-about"),

    model: {
      defaults: {
        tagName: "section",
        name: "About",
        attributes: { class: "tc-about" },

        droppable: false,
        draggable: true,
        removable: true,
        copyable: true,

        styles: aboutCss,

        components: `
          <div class="tc-about__inner">
            <div class="tc-about__copy">
              <span class="tc-about__eyebrow">Who we are</span>
              <h2 class="tc-about__title">
                Travel, but slower &mdash; and <em>made for you.</em>
              </h2>
              <p class="tc-about__lede">
                Tripcart pairs you with local hosts who craft journeys around
                the way you actually like to travel. Less itinerary, more
                instinct. Every stay, table, and detour is hand-picked.
              </p>
              <div class="tc-about__meta">
                <div class="tc-about__meta-item">
                  <span class="tc-about__meta-value">12,400+</span>
                  <span class="tc-about__meta-label">Travelers hosted</span>
                </div>
                <div class="tc-about__meta-item">
                  <span class="tc-about__meta-value">87</span>
                  <span class="tc-about__meta-label">Countries</span>
                </div>
                <div class="tc-about__meta-item">
                  <span class="tc-about__meta-value">4.9 / 5</span>
                  <span class="tc-about__meta-label">Avg. rating</span>
                </div>
              </div>
            </div>

            <div class="tc-about__media">
              <img
                class="tc-about__image"
                alt="A traveler at the edge of a misted ridge"
                src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=1500&fit=crop"
              />
              <div class="tc-about__badge">
                <span class="tc-about__badge-value">12 yrs</span>
                <span class="tc-about__badge-label">curating trips</span>
              </div>
            </div>
          </div>
        `,
      },
    },
  })

  editor.Blocks.add("tc-about", {
    label: "About",
    category: "Sections",
    attributes: { "data-pattern": "true" },
    activate: true,
    resetId: true,
    content: { type: "about-section" },
    media: `
      <svg viewBox="0 0 60 44" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="58" height="42" rx="3" fill="#1e1e2e"/>
        <rect x="6" y="9"  width="14" height="3" rx="1" fill="#6366f1" opacity=".55"/>
        <rect x="6" y="15" width="24" height="6" rx="1.5" fill="#e2e8f0"/>
        <rect x="6" y="24" width="22" height="2" rx="1" fill="#9ca3af"/>
        <rect x="6" y="28" width="18" height="2" rx="1" fill="#9ca3af"/>
        <rect x="34" y="6" width="22" height="32" rx="2" fill="#3f3f5a"/>
        <rect x="36" y="30" width="13" height="6" rx="1" fill="#e2e8f0"/>
      </svg>
    `,
  })
}
