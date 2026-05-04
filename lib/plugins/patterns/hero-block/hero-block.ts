// src/plugins/blocks/hero-block.ts
//
// Hero section block. CSS is authored in hero-block.css and imported
// as a string via Vite's ?raw query, then handed to GrapesJS unchanged
// so parser-postcss parses it and the CssComposer stores it. Flat
// selectors only (no native nesting, no @layer) so getCss() round-trips.
//
// Tokens: --size-*, --gray-*, --font-*, --radius-* come from Open Props
// packs loaded via canvas.styles; --background, --primary, --foreground,
// --muted-foreground, --spacing-* come from designSystemPlugin's :root
// injection.

import type { Component, Editor } from "grapesjs"

// Custom traits exposed on the hero component model. They're stored as plain
// model props (changeProp: true), so we read them through `get` and bypass
// `ComponentProperties`'s strict key set with a narrow cast.
type HeroProp = "heroHeight" | "heroAlign" | "heroBg"
type HeroComponent = Component & { syncStyles: () => void }
const getHeroProp = (cmp: Component, key: HeroProp): string =>
  (cmp.get as (k: string) => unknown)(key) as string

const heroCss = `
.tc-hero {
  display: flex;
  align-items: center;
  min-height: 100svh;
  padding-block: var(--spacing-section);
  padding-inline: clamp(1.25rem, 5vw, 4rem);
  font-family: var(--font-body, var(--font-sans));
  background-color: var(--background, var(--gray-0));
  color: var(--foreground, var(--text-1));
}

.tc-hero .tc-hero__inner {
  width: 100%;
  max-width: var(--size-content-3);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  gap: clamp(0.5rem, 1.2vw, 1rem);
}

.tc-hero .tc-hero__eyebrow {
  font-size: var(--font-size-1);
  font-weight: var(--font-weight-7);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--primary, var(--indigo-6));
}

.tc-hero .tc-hero__title {
  font-family: var(--font-heading, var(--font-sans));
  font-size: clamp(2.25rem, 6.5vw, 5.25rem);
  line-height: 1.02;
  letter-spacing: -0.02em;
  font-weight: var(--font-weight-9);
  max-width: 18ch;
  text-wrap: balance;
  color: var(--foreground, var(--text-1));
}

.tc-hero .tc-hero__subtitle {
  font-size: clamp(1.0625rem, 1.4vw, 1.25rem);
  line-height: 1.55;
  max-width: 56ch;
  text-wrap: pretty;
  color: var(--foreground, var(--text-2));
  margin-block-start: clamp(0.25rem, 0.8vw, 0.75rem);
}

.tc-hero .tc-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--size-3);
  justify-content: flex-start;
  margin-block-start: clamp(0.75rem, 1.6vw, 1.5rem);
}

.tc-hero .tc-hero__cta {
  display: inline-flex;
  align-items: center;
  gap: var(--size-2);
  padding: 0.875rem 1.5rem;
  border: 1px solid transparent;
  border-radius: var(--radius-2);
  font-weight: var(--font-weight-6);
  font-size: var(--font-size-2);
  text-decoration: none;
  transition:
    background-color 220ms cubic-bezier(0.22, 1, 0.36, 1),
    color            220ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color     220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tc-hero .tc-hero__cta:focus-visible {
  outline: 2px solid var(--primary, var(--indigo-6));
  outline-offset: 3px;
}

.tc-hero .tc-hero__cta--primary {
  background: var(--primary, var(--indigo-6));
  color: var(--primary-foreground, var(--gray-0));
  border-color: var(--primary, var(--indigo-6));
}

.tc-hero .tc-hero__cta--primary:hover {
  background: color-mix(in oklch, var(--primary, var(--indigo-6)) 88%, var(--foreground, currentColor));
  border-color: color-mix(in oklch, var(--primary, var(--indigo-6)) 88%, var(--foreground, currentColor));
}

.tc-hero .tc-hero__cta--secondary {
  background: transparent;
  color: var(--foreground, var(--text-1));
  border-color: color-mix(in oklch, var(--foreground, currentColor) 28%, transparent);
}

.tc-hero .tc-hero__cta--secondary:hover {
  border-color: var(--foreground, currentColor);
  background: color-mix(in oklch, var(--foreground, currentColor) 6%, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .tc-hero .tc-hero__cta { transition: none; }
}
`
export const registerHeroBlock = (editor: Editor): void => {
  // ── Component type ──────────────────────────────────────────────────────

  editor.DomComponents.addType("hero-section", {
    isComponent: (el: HTMLElement) => el.classList?.contains("tc-hero"),

    model: {
      defaults: {
        tagName: "section",
        name: "Hero Section",
        attributes: { class: "tc-hero" },

        droppable: false,
        draggable: true,
        removable: true,
        copyable: true,

        styles: heroCss,

        // ── Component children ─────────────────────────────────────────
        components: `
          <div class="tc-hero__inner">
            <span class="tc-hero__eyebrow">Tripcart</span>
            <h1 class="tc-hero__title">Build pages worth shipping.</h1>
            <p class="tc-hero__subtitle">
              Drag, drop, customize. Your brand, your blocks, your pages.
            </p>
            <div class="tc-hero__actions">
              <a href="#" class="tc-hero__cta tc-hero__cta--primary">
                Get started
              </a>
              <a href="#" class="tc-hero__cta tc-hero__cta--secondary">
                Learn more
              </a>
            </div>
          </div>
        `,

        // ── Traits ─────────────────────────────────────────────────────
        traits: [
          {
            type: "select",
            label: "Min Height",
            name: "heroHeight",
            changeProp: true,
            options: [
              { id: "100svh", label: "Full screen" },
              { id: "80svh", label: "80vh" },
              { id: "600px", label: "600px" },
              { id: "400px", label: "400px" },
            ],
            default: "100svh",
          },
          {
            type: "select",
            label: "Text Align",
            name: "heroAlign",
            changeProp: true,
            options: [
              { id: "left", label: "Left" },
              { id: "center", label: "Centre" },
            ],
            default: "left",
          },
          {
            type: "color",
            label: "Background",
            name: "heroBg",
            changeProp: true,
          },
        ],

        heroHeight: "100svh",
        heroAlign: "left",
        heroBg: "",
      },

      init(this: HeroComponent) {
        this.on("change:heroHeight", this.syncStyles)
        this.on("change:heroAlign", this.syncStyles)
        this.on("change:heroBg", this.syncStyles)
      },

      syncStyles(this: HeroComponent) {
        const height = getHeroProp(this, "heroHeight")
        const align = getHeroProp(this, "heroAlign")
        const bg = getHeroProp(this, "heroBg")

        this.addStyle({ "min-height": height })

        const isCenter = align === "center"

        const inner = this.components().find((c: Component) =>
          c.getAttributes().class?.includes("tc-hero__inner")
        )
        inner?.addStyle({
          "text-align": align,
          "align-items": isCenter ? "center" : "flex-start",
        })
        inner
          ?.components()
          .find((c: Component) =>
            c.getAttributes().class?.includes("tc-hero__actions")
          )
          ?.addStyle({ "justify-content": isCenter ? "center" : "flex-start" })

        if (bg) this.addStyle({ "background-color": bg })
      },
    },
  })

  // ── Block registration ──────────────────────────────────────────────────

  editor.Blocks.add("tc-hero", {
    label: "Hero",
    category: "Sections",
    // Marks this block as a pattern so the React block-inserter routes it
    // into the "Patterns" tab. Read via `block.get('attributes')`.
    attributes: { "data-pattern": "true" },
    activate: true,
    resetId: true,
    content: { type: "hero-section" },
    media: `
      <svg viewBox="0 0 60 44" xmlns="http://www.w3.org/2000/svg">
        <rect x="1"  y="1"  width="58" height="42" rx="3" fill="#1e1e2e"/>
        <rect x="6"  y="9"  width="20" height="3"  rx="1"   fill="#6366f1" opacity=".5"/>
        <rect x="6"  y="15" width="40" height="7"  rx="1.5" fill="#e2e8f0"/>
        <rect x="6"  y="25" width="32" height="3"  rx="1"   fill="#9ca3af"/>
        <rect x="6"  y="33" width="13" height="6"  rx="1.5" fill="#6366f1"/>
        <rect x="21" y="33" width="13" height="6"  rx="1.5" fill="none"
              stroke="#9ca3af" stroke-width="1"/>
      </svg>
    `,
  })
}
