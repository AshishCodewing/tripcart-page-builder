// Hero section block. Authored in JSX — `processReactElements` from our
// react-renderer converts JSX to a GrapesJS component definition object, so
// we skip GrapesJS' HTML parse + isComponent recognition (faster + easier to
// read than HTML strings).
//
// Tokens: --size-*, --gray-*, --font-*, --radius-* come from Open Props packs
// loaded via canvas.styles; --background, --primary, --foreground,
// --muted-foreground, --spacing-* come from designSystemPlugin's :root.

import type { CSSProperties } from "react"
import type { Component, Editor } from "grapesjs"
import { processReactElements } from "@/lib/plugins/react-renderer"

type HeroProp = "heroHeight" | "heroAlign" | "heroBg" | "heroVariant"
type HeroVariant = "default" | "minimal" | "announce"
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
  background-color: var(--theme-background, hsl(var(--gray-0-hsl)));
  color: var(--theme-foreground, var(--text-1));
}

.tc-hero__inner {
  width: 100%;
  max-width: var(--size-content-3);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  gap: clamp(0.5rem, 1.2vw, 1rem);
}

.tc-hero__eyebrow {
  font-size: var(--font-size-1);
  font-weight: var(--font-weight-7);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--theme-primary, hsl(var(--indigo-6-hsl)));
}

.tc-hero__title {
  font-family: var(--font-heading, var(--font-sans));
  font-size: clamp(2.25rem, 6.5vw, 5.25rem);
  line-height: 1.02;
  letter-spacing: -0.02em;
  font-weight: var(--font-weight-9);
  max-width: 18ch;
  text-wrap: balance;
  color: var(--theme-foreground, var(--text-1));
}

.tc-hero__subtitle {
  font-size: clamp(1.0625rem, 1.4vw, 1.25rem);
  line-height: 1.55;
  max-width: 56ch;
  text-wrap: pretty;
  color: var(--theme-foreground, var(--text-2));
  margin-block-start: clamp(0.25rem, 0.8vw, 0.75rem);
}

.tc-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--size-3);
  justify-content: flex-start;
  margin-block-start: clamp(0.75rem, 1.6vw, 1.5rem);
}

.tc-hero__cta {
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

.tc-hero__cta:focus-visible {
  outline: 2px solid var(--theme-primary, hsl(var(--indigo-6-hsl)));
  outline-offset: 3px;
}

.tc-hero__cta--primary {
  background: var(--theme-primary, hsl(var(--indigo-6-hsl)));
  color: var(--theme-primary-foreground, hsl(var(--gray-0-hsl)));
  border-color: var(--theme-primary, hsl(var(--indigo-6-hsl)));
}

.tc-hero__cta--primary:hover {
  background: color-mix(in oklch, var(--theme-primary, hsl(var(--indigo-6-hsl))) 88%, var(--theme-foreground, currentColor));
  border-color: color-mix(in oklch, var(--theme-primary, hsl(var(--indigo-6-hsl))) 88%, var(--theme-foreground, currentColor));
}

.tc-hero__cta--secondary {
  background: transparent;
  color: var(--theme-foreground, var(--text-1));
  border-color: color-mix(in oklch, var(--theme-foreground, currentColor) 28%, transparent);
}

.tc-hero__cta--secondary:hover {
  border-color: var(--theme-foreground, currentColor);
  background: color-mix(in oklch, var(--theme-foreground, currentColor) 6%, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .tc-hero__cta { transition: none; }
}
`

export const registerHeroBlock = (editor: Editor): void => {
  // Empty config — processReactElements needs it only to resolve function
  // components against the registry. We use intrinsic HTML tags here, so the
  // lookup never fires.
  const reactConfig = { components: {} }

  // JSX builder: picks a child tree from the current `heroVariant` and seeds
  // align-driven inline styles. Returns a GrapesJS component definition by
  // funneling JSX through the react-renderer's processor.
  const buildHeroChildren = (model: Component): Record<string, unknown> => {
    const variant = (getHeroProp(model, "heroVariant") ||
      "default") as HeroVariant
    const align = getHeroProp(model, "heroAlign") || "left"
    const isCenter = align === "center"

    const innerStyle: CSSProperties = {
      textAlign: align as CSSProperties["textAlign"],
      alignItems: isCenter ? "center" : "flex-start",
    }
    const actionsStyle: CSSProperties = {
      justifyContent: isCenter ? "center" : "flex-start",
    }

    const eyebrow = <span className="tc-hero__eyebrow">Tripcart</span>
    const title = (
      <h1 className="tc-hero__title">Build pages worth shipping.</h1>
    )
    const subtitle = (
      <p className="tc-hero__subtitle">
        Drag, drop, customize. Your brand, your blocks, your pages.
      </p>
    )
    const primaryCta = (
      <a href="#" className="tc-hero__cta tc-hero__cta--primary">
        Get started
      </a>
    )
    const secondaryCta = (
      <a href="#" className="tc-hero__cta tc-hero__cta--secondary">
        Learn more
      </a>
    )

    const inner =
      variant === "minimal" ? (
        <div className="tc-hero__inner" style={innerStyle}>
          {title}
          {subtitle}
        </div>
      ) : variant === "announce" ? (
        <div className="tc-hero__inner" style={innerStyle}>
          {eyebrow}
          {title}
          <div className="tc-hero__actions" style={actionsStyle}>
            {primaryCta}
          </div>
        </div>
      ) : (
        <div className="tc-hero__inner" style={innerStyle}>
          {eyebrow}
          {title}
          {subtitle}
          <div className="tc-hero__actions" style={actionsStyle}>
            {primaryCta}
            {secondaryCta}
          </div>
        </div>
      )

    return processReactElements({
      editor,
      config: reactConfig,
      model: inner,
    }) as Record<string, unknown>
  }

  // ── Component type ────────────────────────────────────────────────────────
  editor.DomComponents.addType("hero-section", {
    isComponent: (el: HTMLElement) => el.classList?.contains("tc-hero"),

    model: {
      defaults: {
        tagName: "section",
        name: "Hero Section",
        classes: ["tc-hero"],

        droppable: false,
        draggable: true,
        removable: true,
        copyable: true,

        styles: heroCss,

        // Function form: GrapesJS calls this once per instantiation. Returns
        // a definition object (cast because GrapesJS' types say string/array
        // only, but the runtime accepts a definition too). On HTML import,
        // parsed children take precedence and this function isn't used.
        components: ((model: Component) =>
          buildHeroChildren(model)) as unknown as string,

        traits: [
          {
            type: "select",
            label: "Variant",
            name: "heroVariant",
            changeProp: true,
            options: [
              { id: "default", label: "Eyebrow + CTAs" },
              { id: "minimal", label: "Title only" },
              { id: "announce", label: "Announcement" },
            ],
            default: "default",
          },
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

        heroVariant: "default",
        heroHeight: "100svh",
        heroAlign: "left",
        heroBg: "",
      },

      init(this: HeroComponent) {
        this.on("change:heroHeight", this.syncStyles)
        this.on("change:heroAlign", this.syncStyles)
        this.on("change:heroBg", this.syncStyles)
        // Variant flip rebuilds the subtree, then re-applies trait-driven
        // styles since `components()` replacement wipes prior inline styles.
        this.on("change:heroVariant", () => {
          this.components(
            buildHeroChildren(this) as unknown as Parameters<
              typeof this.components
            >[0]
          )
          this.syncStyles()
        })
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

  // ── Block registration ────────────────────────────────────────────────────
  // Three blocks share one component type. Each pre-seeds `heroVariant`, so
  // the JSX builder produces a different child tree per block.

  const heroBlocks: Array<{
    id: string
    label: string
    variant: HeroVariant
    media: string
  }> = [
    {
      id: "tc-hero",
      label: "Hero",
      variant: "default",
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
    },
    {
      id: "tc-hero-minimal",
      label: "Hero · Minimal",
      variant: "minimal",
      media: `
        <svg viewBox="0 0 60 44" xmlns="http://www.w3.org/2000/svg">
          <rect x="1"  y="1"  width="58" height="42" rx="3" fill="#1e1e2e"/>
          <rect x="6"  y="15" width="44" height="7"  rx="1.5" fill="#e2e8f0"/>
          <rect x="6"  y="26" width="36" height="3"  rx="1"   fill="#9ca3af"/>
        </svg>
      `,
    },
    {
      id: "tc-hero-announce",
      label: "Hero · Announce",
      variant: "announce",
      media: `
        <svg viewBox="0 0 60 44" xmlns="http://www.w3.org/2000/svg">
          <rect x="1"  y="1"  width="58" height="42" rx="3" fill="#1e1e2e"/>
          <rect x="6"  y="9"  width="20" height="3"  rx="1"   fill="#6366f1" opacity=".5"/>
          <rect x="6"  y="15" width="44" height="7"  rx="1.5" fill="#e2e8f0"/>
          <rect x="6"  y="30" width="13" height="6"  rx="1.5" fill="#6366f1"/>
        </svg>
      `,
    },
  ]

  heroBlocks.forEach(({ id, label, variant, media }) => {
    editor.Blocks.add(id, {
      label,
      category: "Sections",
      attributes: { "data-pattern": "true" },
      activate: true,
      resetId: true,
      content: { type: "hero-section", heroVariant: variant },
      media,
    })
  })
}
