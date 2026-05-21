// Card pattern family — demonstration set for GrapesJS' component-type
// extension mechanics. Three variants share a single base type.
//
//   • `tc-card-base`            — shared behavior carrier (no Block). Owns
//                                 the analytics + theme traits, BEM-rooted
//                                 wrapper, and shared listeners. Everything
//                                 that should be inherited lives here, in
//                                 the *initial* defaults — see the comment
//                                 above its declaration for why.
//   • `tc-card-feature`         — uses `extend: 'tc-card-base'`. Icon + title
//                                 + body. Adds its own `view` with a click
//                                 handler on the icon.
//   • `tc-card-stat`            — uses `extend: 'tc-card-base'`. Big number
//                                 + label + caption layout.
//   • `tc-card-quote`           — uses `extend: 'tc-card-base'` for the
//                                 model AND `extendView: 'tc-card-feature'`
//                                 to mix in feature's view behavior on a
//                                 different model.
//   • Patch on built-in `image` — re-calls `addType('image', …)` to add
//                                 `loading="lazy"` + `decoding="async"`
//                                 globally. The only "update component
//                                 type" demo in this file — patching a
//                                 type nothing else `extend`s from is the
//                                 safe shape for this mechanic.
//
// Tokens: Open Props (`--size-*`, `--font-*`, `--radius-*`, `--gray-*-hsl`,
// `--indigo-*-hsl`, `--shadow-*`) and the design-system theme vars
// (`--theme-background`, `--theme-foreground`, `--theme-primary`,
// `--theme-primary-foreground`, `--theme-border`).

import type { Component, Editor } from "grapesjs"

type CardProp = "cardTrack" | "cardTheme"
type CardComponent = Component & { applyCardTheme: () => void }
const getCardProp = (cmp: Component, key: CardProp): string =>
  (cmp.get as (k: string) => unknown)(key) as string

const cardsCss = `
.tc-card {
  --tc-card-bg: var(--theme-background, hsl(var(--gray-0-hsl)));
  --tc-card-fg: var(--theme-foreground, hsl(var(--gray-12-hsl)));
  --tc-card-muted: color-mix(in oklch, var(--tc-card-fg) 62%, transparent);
  --tc-card-border: var(--theme-border, color-mix(in oklch, var(--tc-card-fg) 12%, transparent));
  --tc-card-accent: var(--theme-primary, hsl(var(--indigo-6-hsl)));
  --tc-card-accent-fg: var(--theme-primary-foreground, hsl(var(--gray-0-hsl)));

  display: flex;
  flex-direction: column;
  gap: var(--size-3);
  padding: clamp(1.25rem, 2vw, 1.75rem);
  background: var(--tc-card-bg);
  color: var(--tc-card-fg);
  border: 1px solid var(--tc-card-border);
  border-radius: var(--radius-3, 0.875rem);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 16px 32px -24px rgba(0, 0, 0, 0.18);
  font-family: var(--font-body, var(--font-sans));
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tc-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.05),
    0 28px 48px -20px rgba(0, 0, 0, 0.22);
}

/* Patch-injected theme modifier (applied at runtime by applyCardTheme). */
.tc-card--theme-dark {
  --tc-card-bg: color-mix(in oklch, hsl(var(--gray-12-hsl)) 92%, black);
  --tc-card-fg: hsl(var(--gray-0-hsl));
  --tc-card-border: color-mix(in oklch, hsl(var(--gray-0-hsl)) 14%, transparent);
}

.tc-card--theme-accent {
  --tc-card-bg: var(--tc-card-accent);
  --tc-card-fg: var(--tc-card-accent-fg);
  --tc-card-border: color-mix(in oklch, var(--tc-card-accent-fg) 22%, transparent);
}

/* ── Feature variant ──────────────────────────────────────────────────── */
/* Child class names are variant-unique (only feature cards mount
   .tc-card__icon, only stat cards mount .tc-card__stat-*, etc.), so the
   ancestor selector adds nothing functional and was blocking the Style
   Manager parent-target cascade for those children. */
.tc-card__icon {
  inline-size: var(--size-7);
  block-size: var(--size-7);
  display: grid;
  place-items: center;
  border-radius: var(--radius-2, 0.5rem);
  background: color-mix(in oklch, var(--tc-card-accent) 14%, transparent);
  color: var(--tc-card-accent);
  font-size: var(--font-size-4);
  font-weight: var(--font-weight-8);
  cursor: pointer;
}

.tc-card__title {
  font-family: var(--font-heading, var(--font-sans));
  font-size: var(--font-size-4);
  font-weight: var(--font-weight-8);
  letter-spacing: -0.01em;
  line-height: 1.15;
  margin: 0;
}

.tc-card__body {
  font-size: var(--font-size-2);
  line-height: 1.55;
  color: var(--tc-card-muted);
  margin: 0;
  text-wrap: pretty;
}

/* ── Stat variant ─────────────────────────────────────────────────────── */
.tc-card--stat {
  align-items: flex-start;
  gap: var(--size-2);
}

.tc-card__stat-value {
  font-family: var(--font-heading, var(--font-sans));
  font-size: clamp(2.5rem, 5vw, 3.5rem);
  font-weight: var(--font-weight-9);
  letter-spacing: -0.025em;
  line-height: 1;
  color: var(--tc-card-accent);
}

.tc-card__stat-label {
  font-size: var(--font-size-1);
  font-weight: var(--font-weight-7);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--tc-card-fg);
}

.tc-card__stat-caption {
  font-size: var(--font-size-1);
  line-height: 1.55;
  color: var(--tc-card-muted);
  margin: 0;
  text-wrap: pretty;
}

/* ── Quote variant ────────────────────────────────────────────────────── */
.tc-card--quote {
  gap: var(--size-4);
  position: relative;
}

.tc-card--quote::before {
  content: "\\201C";
  position: absolute;
  inset-block-start: -0.35em;
  inset-inline-start: 0.35em;
  font-family: var(--font-heading, var(--font-sans));
  font-size: clamp(4rem, 8vw, 6rem);
  line-height: 1;
  color: color-mix(in oklch, var(--tc-card-accent) 38%, transparent);
  pointer-events: none;
}

.tc-card__quote {
  font-family: var(--font-heading, var(--font-sans));
  font-size: var(--font-size-4);
  font-weight: var(--font-weight-6);
  line-height: 1.35;
  letter-spacing: -0.005em;
  margin: 0;
  text-wrap: balance;
}

.tc-card__attribution {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.tc-card__author {
  font-size: var(--font-size-2);
  font-weight: var(--font-weight-7);
}

.tc-card__role {
  font-size: var(--font-size-1);
  color: var(--tc-card-muted);
}

@media (prefers-reduced-motion: reduce) {
  .tc-card { transition: none; }
  .tc-card:hover { transform: none; }
}
`

const cardThemeOptions = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "accent", label: "Accent" },
]

export const registerCardBlocks = (editor: Editor): void => {
  // ── 1. Base type ──────────────────────────────────────────────────────
  // Pure behavior carrier. No Block is registered for it — the user can't
  // drop a "base card" onto the canvas. Its job is to centralize traits +
  // listeners every variant should inherit.
  //
  // IMPORTANT: every inheritable trait/init must live HERE, in the initial
  // declaration. Variants register with `extend: 'tc-card-base'`, which
  // captures the parent's defaults at extension time. A later
  // `addType('tc-card-base', …)` patch does NOT retroactively propagate
  // its added traits/init to types that have already been extended from
  // this one. So if you want every card to get a new trait, add it here.
  editor.DomComponents.addType("tc-card-base", {
    isComponent: (el: HTMLElement) => el.classList?.contains("tc-card"),

    model: {
      defaults: {
        tagName: "article",
        name: "Card",
        classes: ["tc-card"],
        droppable: false,
        draggable: true,
        removable: true,
        copyable: true,

        styles: cardsCss,

        traits: [
          {
            type: "text",
            name: "cardTrack",
            label: "Analytics ID",
            placeholder: "e.g. home-feature-1",
            changeProp: true,
          },
          {
            type: "select",
            name: "cardTheme",
            label: "Theme",
            options: cardThemeOptions,
            default: "light",
            changeProp: true,
          },
        ],
        cardTrack: "",
        cardTheme: "light",
      },

      init(this: CardComponent) {
        // Mirror `cardTrack` onto a `data-track` attribute so the published
        // page can read it with no extra wiring.
        this.on("change:cardTrack", () => {
          const id = getCardProp(this, "cardTrack")
          this.addAttributes({ "data-track": id || null })
        })
        this.on("change:cardTheme", this.applyCardTheme)
      },

      applyCardTheme(this: CardComponent) {
        const theme = getCardProp(this, "cardTheme") || "light"
        const classes = this.getClasses() as string[]
        // Strip any prior theme modifier, then add the new one. `light` is
        // the implicit default so it gets no class.
        const cleaned = classes.filter(
          (c: string) => !c.startsWith("tc-card--theme-")
        )
        this.setClass(cleaned)
        if (theme !== "light") this.addClass(`tc-card--theme-${theme}`)
      },
    },
  })

  // ── 2. Feature variant — `extend` only ────────────────────────────────
  // Inherits the base model (analytics trait, init listener) and adds a
  // small view on top. The view's `events` map demonstrates that view
  // behavior is what `extendView` will pick up downstream.
  editor.DomComponents.addType("tc-card-feature", {
    extend: "tc-card-base",
    isComponent: (el: HTMLElement) =>
      el.classList?.contains("tc-card") &&
      el.classList?.contains("tc-card--feature"),

    model: {
      defaults: {
        // Shallow-merged into base defaults: keeps `tagName: 'article'` and
        // the base traits, overrides `attributes` and adds children.
        classes: ["tc-card", "tc-card--feature"],
        components: `
          <div class="tc-card__icon" title="Click me in canvas">★</div>
          <h3 class="tc-card__title">Hand-picked stays</h3>
          <p class="tc-card__body">
            Every property is visited by a Tripcart curator before it earns
            a place on your shortlist.
          </p>
        `,
      },
    },

    view: {
      // Demo: a view-level event. Inherited by `tc-card-quote` via
      // extendView so quote cards also fire this on icon clicks (even
      // though their model doesn't include an icon — that's the point of
      // composition; the view just won't find a match and no-op).
      events: () => ({ "click .tc-card__icon": "onIconClick" }),
      onIconClick() {
        // Editor-only feedback — published pages don't run view code.
        console.log("[tc-card-feature] icon clicked")
      },
    },
  })

  // ── 3. Stat variant — `extend` only ───────────────────────────────────
  // Same inheritance pattern as feature, no custom view.
  editor.DomComponents.addType("tc-card-stat", {
    extend: "tc-card-base",
    isComponent: (el: HTMLElement) =>
      el.classList?.contains("tc-card") &&
      el.classList?.contains("tc-card--stat"),

    model: {
      defaults: {
        classes: ["tc-card", "tc-card--stat"],
        components: `
          <span class="tc-card__stat-value">12,400+</span>
          <span class="tc-card__stat-label">Travelers hosted</span>
          <p class="tc-card__stat-caption">
            Across 87 countries since 2014, every itinerary still gets a
            human review.
          </p>
        `,
      },
    },
  })

  // ── 4. Quote variant — `extend` + `extendView` ────────────────────────
  // Model still inherits from `tc-card-base` (so analytics trait/listener
  // come along). View inherits from `tc-card-feature` (so the icon-click
  // event handler is present even though quote cards render no icon).
  editor.DomComponents.addType("tc-card-quote", {
    extend: "tc-card-base",
    extendView: "tc-card-feature",
    isComponent: (el: HTMLElement) =>
      el.classList?.contains("tc-card") &&
      el.classList?.contains("tc-card--quote"),

    model: {
      defaults: {
        classes: ["tc-card", "tc-card--quote"],
        components: `
          <blockquote class="tc-card__quote">
            They listened. The trip felt less like a package and more like
            a conversation that never quite ended.
          </blockquote>
          <div class="tc-card__attribution">
            <span class="tc-card__author">Maya Okonkwo</span>
            <span class="tc-card__role">Booked a 14-day Andes route</span>
          </div>
        `,
      },
    },
  })

  // ── 5. Update component type — patch built-in `image` ─────────────────
  // Cross-cutting augmentation: every image in the editor now defaults to
  // lazy loading and async decoding. The original image model/view are
  // untouched otherwise. Demonstrates patching a type you don't own.
  editor.DomComponents.addType("image", {
    model: {
      defaults: {
        attributes: { loading: "lazy", decoding: "async" },
      },
    },
  })

  // ── Block registrations ───────────────────────────────────────────────
  // Each Block targets one of the extended types. No Block targets
  // `tc-card-base` — it's an internal behavior carrier.

  editor.Blocks.add("tc-card-feature", {
    label: "Card · Feature",
    category: "Cards",
    attributes: { "data-pattern": "true" },
    activate: true,
    resetId: true,
    content: { type: "tc-card-feature" },
    media: `
      <svg viewBox="0 0 60 44" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="58" height="42" rx="3" fill="#1e1e2e"/>
        <rect x="7" y="8" width="9" height="9" rx="2" fill="#6366f1" opacity=".55"/>
        <rect x="7" y="21" width="34" height="4" rx="1" fill="#e2e8f0"/>
        <rect x="7" y="29" width="42" height="2.5" rx="1" fill="#9ca3af"/>
        <rect x="7" y="34" width="36" height="2.5" rx="1" fill="#9ca3af"/>
      </svg>
    `,
  })

  editor.Blocks.add("tc-card-stat", {
    label: "Card · Stat",
    category: "Cards",
    attributes: { "data-pattern": "true" },
    activate: true,
    resetId: true,
    content: { type: "tc-card-stat" },
    media: `
      <svg viewBox="0 0 60 44" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="58" height="42" rx="3" fill="#1e1e2e"/>
        <rect x="7" y="9" width="28" height="14" rx="1.5" fill="#6366f1"/>
        <rect x="7" y="26" width="20" height="3" rx="1" fill="#e2e8f0"/>
        <rect x="7" y="32" width="42" height="2.5" rx="1" fill="#9ca3af"/>
        <rect x="7" y="37" width="34" height="2.5" rx="1" fill="#9ca3af"/>
      </svg>
    `,
  })

  editor.Blocks.add("tc-card-quote", {
    label: "Card · Quote",
    category: "Cards",
    attributes: { "data-pattern": "true" },
    activate: true,
    resetId: true,
    content: { type: "tc-card-quote" },
    media: `
      <svg viewBox="0 0 60 44" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="58" height="42" rx="3" fill="#1e1e2e"/>
        <text x="7" y="20" font-family="serif" font-size="22" fill="#6366f1" opacity=".55">&#8220;</text>
        <rect x="17" y="11" width="36" height="3" rx="1" fill="#e2e8f0"/>
        <rect x="17" y="17" width="30" height="3" rx="1" fill="#e2e8f0"/>
        <rect x="7" y="30" width="20" height="2.5" rx="1" fill="#9ca3af"/>
        <rect x="7" y="35" width="14" height="2.5" rx="1" fill="#9ca3af" opacity=".7"/>
      </svg>
    `,
  })
}
