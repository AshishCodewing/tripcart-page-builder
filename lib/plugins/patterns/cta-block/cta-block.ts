// CTA section — full-bleed primary surface with a centered editorial pitch
// and two actions. Same authoring pattern as hero-block.

import type { Editor } from "grapesjs"

const ctaCss = `
.tc-cta {
  position: relative;
  padding-block: clamp(4.5rem, 9vw, 7.5rem);
  padding-inline: clamp(1.25rem, 5vw, 4rem);
  background: var(--primary, var(--indigo-7));
  color: var(--primary-foreground, var(--gray-0));
  font-family: var(--font-body, var(--font-sans));
  overflow: hidden;
  isolation: isolate;
}

/* Decorative diagonal stripe — purely visual, doesn't shift layout. */
.tc-cta::before {
  content: "";
  position: absolute;
  inset: -40% -10% auto auto;
  width: 60%;
  height: 180%;
  background: color-mix(in oklch, var(--primary-foreground, var(--gray-0)) 6%, transparent);
  transform: rotate(18deg);
  z-index: -1;
  pointer-events: none;
}

.tc-cta .tc-cta__inner {
  max-width: 56rem;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: clamp(1rem, 2vw, 1.5rem);
}

.tc-cta .tc-cta__eyebrow {
  font-size: var(--font-size-0);
  font-weight: var(--font-weight-7);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: color-mix(in oklch, var(--primary-foreground, var(--gray-0)) 78%, transparent);
  margin: 0;
}

.tc-cta .tc-cta__title {
  font-family: var(--font-heading, var(--font-sans));
  font-size: clamp(2.25rem, 5.5vw, 4.25rem);
  line-height: 1.04;
  letter-spacing: -0.02em;
  font-weight: var(--font-weight-9);
  margin: 0;
  text-wrap: balance;
}

.tc-cta .tc-cta__title em {
  font-style: italic;
  font-weight: var(--font-weight-7);
  color: color-mix(in oklch, var(--primary-foreground, var(--gray-0)) 88%, transparent);
}

.tc-cta .tc-cta__subtitle {
  font-size: clamp(1.0625rem, 1.4vw, 1.1875rem);
  line-height: 1.55;
  max-width: 42rem;
  text-wrap: pretty;
  color: color-mix(in oklch, var(--primary-foreground, var(--gray-0)) 82%, transparent);
  margin: 0;
}

.tc-cta .tc-cta__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--size-3, 1rem);
  justify-content: center;
  margin-block-start: clamp(0.75rem, 1.5vw, 1.25rem);
}

.tc-cta .tc-cta__btn {
  display: inline-flex;
  align-items: center;
  gap: var(--size-2, 0.5rem);
  padding: 0.875rem 1.625rem;
  border: 1px solid transparent;
  border-radius: var(--radius-round, 999px);
  font-weight: var(--font-weight-6);
  font-size: var(--font-size-2, 1.0625rem);
  text-decoration: none;
  transition:
    background-color 220ms cubic-bezier(0.22, 1, 0.36, 1),
    color            220ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color     220ms cubic-bezier(0.22, 1, 0.36, 1),
    transform        220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tc-cta .tc-cta__btn:focus-visible {
  outline: 2px solid var(--primary-foreground, var(--gray-0));
  outline-offset: 3px;
}

.tc-cta .tc-cta__btn--primary {
  background: var(--primary-foreground, var(--gray-0));
  color: var(--primary, var(--indigo-7));
  border-color: var(--primary-foreground, var(--gray-0));
}

.tc-cta .tc-cta__btn--primary:hover {
  transform: translateY(-1px);
  background: color-mix(in oklch, var(--primary-foreground, var(--gray-0)) 92%, transparent);
}

.tc-cta .tc-cta__btn--secondary {
  background: transparent;
  color: var(--primary-foreground, var(--gray-0));
  border-color: color-mix(in oklch, var(--primary-foreground, var(--gray-0)) 40%, transparent);
}

.tc-cta .tc-cta__btn--secondary:hover {
  border-color: var(--primary-foreground, var(--gray-0));
  background: color-mix(in oklch, var(--primary-foreground, var(--gray-0)) 8%, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .tc-cta .tc-cta__btn { transition: none; }
}
`

export const registerCtaBlock = (editor: Editor): void => {
  editor.DomComponents.addType("cta-section", {
    isComponent: (el: HTMLElement) => el.classList?.contains("tc-cta"),

    model: {
      defaults: {
        tagName: "section",
        name: "Call to Action",
        attributes: { class: "tc-cta" },

        droppable: false,
        draggable: true,
        removable: true,
        copyable: true,

        styles: ctaCss,

        components: `
          <div class="tc-cta__inner">
            <span class="tc-cta__eyebrow">The next chapter</span>
            <h2 class="tc-cta__title">
              Your trip <em>starts</em> with a conversation.
            </h2>
            <p class="tc-cta__subtitle">
              Tell us where your head's been wandering. We'll come back with
              a few quiet ideas, hand-picked, never templated.
            </p>
            <div class="tc-cta__actions">
              <a href="#" class="tc-cta__btn tc-cta__btn--primary">
                Plan a trip
              </a>
              <a href="#" class="tc-cta__btn tc-cta__btn--secondary">
                Talk to a host
              </a>
            </div>
          </div>
        `,
      },
    },
  })

  editor.Blocks.add("tc-cta", {
    label: "Call to Action",
    category: "Sections",
    attributes: { "data-pattern": "true" },
    activate: true,
    resetId: true,
    content: { type: "cta-section" },
    media: `
      <svg viewBox="0 0 60 44" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="58" height="42" rx="3" fill="#6366f1"/>
        <path d="M40 -4 L72 14 L72 -8 Z" fill="#ffffff" opacity=".08"/>
        <rect x="14" y="13" width="32" height="4" rx="1" fill="#ffffff"/>
        <rect x="18" y="20" width="24" height="2" rx="1" fill="#ffffff" opacity=".55"/>
        <rect x="14" y="29" width="14" height="6" rx="3" fill="#ffffff"/>
        <rect x="32" y="29" width="14" height="6" rx="3" fill="none"
              stroke="#ffffff" stroke-width="1" opacity=".7"/>
      </svg>
    `,
  })
}
