// Testimonial section — a single editorial pull-quote with a decorative
// quotation mark and an attribution row. Same authoring pattern as
// hero-block.

import type { Editor } from "grapesjs"

const testimonialCss = `
.tc-testimonial {
  position: relative;
  padding-block: clamp(5rem, 10vw, 9rem);
  padding-inline: clamp(1.25rem, 5vw, 4rem);
  background: var(--muted, color-mix(in oklch, var(--foreground, var(--gray-12)) 4%, var(--background, var(--gray-0))));
  color: var(--foreground, var(--gray-12));
  font-family: var(--font-body, var(--font-sans));
  overflow: hidden;
}

.tc-testimonial .tc-testimonial__inner {
  position: relative;
  max-width: 64rem;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: clamp(1.75rem, 3vw, 2.5rem);
}

/* Oversized opening quote — purely decorative. */
.tc-testimonial .tc-testimonial__mark {
  font-family: var(--font-heading, var(--font-serif, serif));
  font-size: clamp(7rem, 14vw, 12rem);
  line-height: 0.7;
  font-weight: var(--font-weight-9);
  color: var(--primary, var(--indigo-6));
  opacity: 0.18;
  user-select: none;
  letter-spacing: -0.05em;
  margin: 0;
  align-self: center;
}

.tc-testimonial .tc-testimonial__quote {
  font-family: var(--font-heading, var(--font-sans));
  font-size: clamp(1.625rem, 3.4vw, 2.5rem);
  line-height: 1.22;
  letter-spacing: -0.012em;
  font-weight: var(--font-weight-6);
  margin: 0;
  text-wrap: balance;
  max-width: 48rem;
}

.tc-testimonial .tc-testimonial__quote em {
  font-style: italic;
  color: var(--primary, var(--indigo-6));
  font-weight: var(--font-weight-7);
}

.tc-testimonial .tc-testimonial__attribution {
  display: flex;
  align-items: center;
  gap: clamp(0.875rem, 1.6vw, 1.125rem);
  padding-block-start: clamp(0.75rem, 1.5vw, 1rem);
  border-block-start: 1px solid var(--border, color-mix(in oklch, var(--foreground, var(--gray-12)) 12%, transparent));
}

.tc-testimonial .tc-testimonial__avatar {
  width: clamp(2.75rem, 4vw, 3.25rem);
  height: clamp(2.75rem, 4vw, 3.25rem);
  border-radius: 999px;
  object-fit: cover;
  flex-shrink: 0;
  display: block;
  border: 2px solid var(--background, var(--gray-0));
  box-shadow: 0 4px 12px -4px rgba(0, 0, 0, 0.12);
}

.tc-testimonial .tc-testimonial__author {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.0625rem;
  text-align: start;
}

.tc-testimonial .tc-testimonial__author-name {
  font-family: var(--font-heading, var(--font-sans));
  font-size: var(--font-size-2, 1.0625rem);
  font-weight: var(--font-weight-7);
  letter-spacing: -0.005em;
  color: var(--foreground, var(--gray-12));
  line-height: 1.2;
}

.tc-testimonial .tc-testimonial__author-meta {
  font-size: var(--font-size-0, 0.8125rem);
  color: var(--foreground, var(--gray-7));
  letter-spacing: 0.04em;
}

.tc-testimonial .tc-testimonial__divider {
  width: 1px;
  height: 1.5rem;
  background: var(--border, color-mix(in oklch, var(--foreground, var(--gray-12)) 20%, transparent));
}
`

export const registerTestimonialBlock = (editor: Editor): void => {
  editor.DomComponents.addType("testimonial-section", {
    isComponent: (el: HTMLElement) => el.classList?.contains("tc-testimonial"),

    model: {
      defaults: {
        tagName: "section",
        name: "Testimonial",
        attributes: { class: "tc-testimonial" },

        droppable: false,
        draggable: true,
        removable: true,
        copyable: true,

        styles: testimonialCss,

        components: `
          <div class="tc-testimonial__inner">
            <span class="tc-testimonial__mark" aria-hidden="true">&ldquo;</span>
            <blockquote class="tc-testimonial__quote">
              They listened more than they pitched. Three weeks later we were
              eating handmade pici in a kitchen we'd never have found, with a
              host who already knew our coffee order. <em>It felt like a
              friend planned it.</em>
            </blockquote>
            <figcaption class="tc-testimonial__attribution">
              <img
                class="tc-testimonial__avatar"
                alt=""
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&h=160&fit=crop"
              />
              <div class="tc-testimonial__author">
                <span class="tc-testimonial__author-name">Mira Castellano</span>
                <span class="tc-testimonial__author-meta">Toscana &middot; June '25</span>
              </div>
            </figcaption>
          </div>
        `,
      },
    },
  })

  editor.Blocks.add("tc-testimonial", {
    label: "Testimonial",
    category: "Sections",
    attributes: { "data-pattern": "true" },
    activate: true,
    resetId: true,
    content: { type: "testimonial-section" },
    media: `
      <svg viewBox="0 0 60 44" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="58" height="42" rx="3" fill="#1e1e2e"/>
        <text x="9" y="22" font-family="serif" font-size="22" font-weight="900"
              fill="#6366f1" opacity=".55">&#8220;</text>
        <rect x="9"  y="22" width="42" height="3" rx="1" fill="#e2e8f0"/>
        <rect x="9"  y="28" width="36" height="3" rx="1" fill="#e2e8f0"/>
        <circle cx="14" cy="37" r="3" fill="#6366f1"/>
        <rect x="20" y="35" width="20" height="2" rx="1" fill="#9ca3af"/>
        <rect x="20" y="38.5" width="14" height="1.5" rx=".75" fill="#6b7280"/>
      </svg>
    `,
  })
}
