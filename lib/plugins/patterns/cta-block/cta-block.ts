// CTA section — hybrid React/GrapesJS block.
//
//   • The React shell (CtaSection) owns the section wrapper, decorative
//     background / next/image, layout container, and the next/link CTA
//     buttons (whose label + href flow in via traits).
//
//   • The editorial text — eyebrow, title, subtitle — is dropped into the
//     block as regular GrapesJS text components, so authors can click each
//     one in the canvas, edit copy via RTE, and restyle via the right panel.
//     The renderer surfaces them through the React shell's `children` prop
//     because `allowChildren: true` is set on the component config.

import type { Editor } from "grapesjs"
import type { ComponentConfig } from "@/lib/plugins/react-renderer"
import { ctaDescriptor } from "@/lib/plugins/patterns/manifest"
import { CtaSection } from "./cta-section"

export const ctaSectionType = "cta-section"

// Tailwind classes for the slot text components. Set as `attributes.class`
// so they survive serialization; the user can still override via the style
// manager. Kept in sync with the typography scale used elsewhere in the
// pattern set (eyebrow/title/subtitle).
const eyebrowClass =
  "text-xs font-bold tracking-[0.22em] text-primary-foreground/80 uppercase"
const titleClass =
  "text-[clamp(2.25rem,5.5vw,4.25rem)] leading-[1.04] font-black tracking-[-0.02em] text-balance"
const subtitleClass =
  "max-w-xl text-[clamp(1.0625rem,1.4vw,1.1875rem)] leading-[1.55] text-pretty text-primary-foreground/80"

export const ctaSectionConfig: ComponentConfig = {
  component: CtaSection,
  // KEY: enables the hybrid pattern. The React component's `children` prop
  // is fed by the model's child components, each individually selectable
  // and editable in the canvas.
  allowChildren: true,
  allowPropClassName: false,
  allowPropId: false,
  props: () => [
    { type: "text", name: "primaryLabel", label: "Primary CTA" },
    { type: "text", name: "primaryHref", label: "Primary URL" },
    { type: "text", name: "secondaryLabel", label: "Secondary CTA" },
    { type: "text", name: "secondaryHref", label: "Secondary URL" },
    { type: "text", name: "imageSrc", label: "Background image URL" },
    { type: "text", name: "imageAlt", label: "Background image alt" },
  ],
  model: {
    defaults: {
      tagName: "section",
      name: "Call to Action",
      attributes: {
        primaryLabel: "Plan a trip",
        primaryHref: "#",
        secondaryLabel: "Talk to a host",
        secondaryHref: "#",
      },
      draggable: true,
      removable: true,
      copyable: true,
    },
  },
}

export const registerCtaBlock = (editor: Editor): void => {
  editor.Blocks.add(ctaDescriptor.id, {
    label: ctaDescriptor.label,
    category: ctaDescriptor.category,
    attributes: { "data-pattern": "true" },
    activate: true,
    resetId: true,
    content: {
      type: ctaSectionType,
      components: [
        {
          type: "text",
          tagName: "span",
          attributes: { class: eyebrowClass },
          components: [{ type: "textnode", content: "The next chapter" }],
        },
        {
          type: "text",
          tagName: "h2",
          attributes: { class: titleClass },
          components: [
            {
              type: "textnode",
              content: "Your trip starts with a conversation.",
            },
          ],
        },
        {
          type: "text",
          tagName: "p",
          attributes: { class: subtitleClass },
          components: [
            {
              type: "textnode",
              content:
                "Tell us where your head's been wandering. We'll come back with a few quiet ideas, hand-picked, never templated.",
            },
          ],
        },
      ],
    },
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
