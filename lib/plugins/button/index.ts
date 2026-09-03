// Button block — the `tc-button` component type plus its "Basic" palette entry.
//
// Split of responsibilities (WordPress's model):
//   • This plugin owns STRUCTURE: display, padding, font, cursor, focus ring.
//     Every rule sits in `:where()` (specificity 0-0-0) so the theme and any
//     Style-Manager edit override it trivially.
//   • The theme owns the LOOK: `styles.elements.button` compiles to
//     `.tc-element-button` only (lib/theme/compile.ts), and its
//     `variations.<slug>` to `.tc-element-button.is-style-<slug>`. Looking
//     like a button is opt-in by wearing that marker (WP's
//     `.wp-element-button`); the theme never targets the bare `button` tag.
//   • The `variant` trait only toggles `is-style-outline`; it carries no CSS.
//
// Extends the built-in `link` type for the href/target/title traits and the
// canvas click suppression. `isComponent` is redefined because the inherited
// matcher claims every `<a>`; ours requires the `.tc-button` type class.

import type { Component, Editor, Plugin } from "grapesjs"

import { ELEMENT_BUTTON_CLASS, variationClass } from "@/lib/theme/compile"

export const BUTTON_TYPE = "tc-button"

const TYPE_CLASS = "tc-button"
const OUTLINE_CLASS = variationClass("outline")

export type ButtonVariant = "fill" | "outline"

type ButtonModel = Component & {
  syncVariant(): void
}

// Structural only — colors, radius, border width/color and text-decoration
// come from the theme's `elements.button` rules.
const buttonCss = `
:where(.${TYPE_CLASS}) {
  display: inline-block;
  padding: var(--tc--preset--spacing--sm, var(--size-2)) var(--tc--preset--spacing--md, var(--size-4));
  font-family: var(--tc--preset--font-family--body, var(--font-sans));
  font-size: var(--tc--preset--font-size--medium, 1rem);
  line-height: var(--tc--preset--line-height--tight, 1.25);
  text-align: center;
  cursor: pointer;
  border-width: 0;
  border-style: solid;
  transition:
    background-color 0.15s var(--ease-2),
    color 0.15s var(--ease-2),
    border-color 0.15s var(--ease-2);
}

:where(.${TYPE_CLASS}:focus-visible) {
  outline: 2px solid var(--tc--preset--color--ring, currentColor);
  outline-offset: 2px;
}
`

const ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="10" rx="3"/><path d="M8 12h8"/></svg>`

export const buttonPlugin: Plugin = (editor: Editor): void => {
  editor.Components.addType(BUTTON_TYPE, {
    extend: "link",
    isComponent: (el) =>
      el.tagName?.toLowerCase() === "a" &&
      el.classList?.contains(TYPE_CLASS) === true,
    model: {
      defaults: {
        name: "Button",
        tagName: "a",
        classes: [TYPE_CLASS, ELEMENT_BUTTON_CLASS],
        // The label is a single editable text run; nothing drops inside.
        droppable: false,
        variant: "fill",
        traits: [
          "href",
          "target",
          "title",
          {
            type: "select",
            name: "variant",
            label: "Style",
            changeProp: true,
            options: [
              { id: "fill", label: "Fill" },
              { id: "outline", label: "Outline" },
            ],
          },
        ],
        styles: buttonCss,
      },
      init(this: ButtonModel) {
        // Parsed HTML replaces the default class list wholesale (GrapesJS
        // `initClasses`), so re-assert the identity classes and read the
        // variant back from the markup.
        this.addClass(TYPE_CLASS)
        this.addClass(ELEMENT_BUTTON_CLASS)
        if (this.getClasses().includes(OUTLINE_CLASS)) {
          this.set("variant", "outline")
        }
        this.on("change:variant", this.syncVariant)
        this.syncVariant()
      },
      syncVariant(this: ButtonModel) {
        if (this.get("variant") === "outline") this.addClass(OUTLINE_CLASS)
        else this.removeClass(OUTLINE_CLASS)
      },
    },
  })

  editor.Blocks.add(BUTTON_TYPE, {
    label: "Button",
    category: "Basic",
    media: ICON,
    select: true,
    content: { type: BUTTON_TYPE, content: "Book now" },
  })
}

export default buttonPlugin
