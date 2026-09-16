// Heading block — the `tc-heading` component type plus its "Basic" palette entry.
//
// Split of responsibilities (the same WordPress model the Button block follows):
//   • This plugin owns STRUCTURE: which tag the node renders as. The `level`
//     property (1-6) is the single source of truth; `tagName` is derived from
//     it, so `<h1>`…`<h6>` is a property change, not a re-drop.
//   • The theme owns the LOOK: `styles.elements.heading` compiles to
//     `h1, h2, …, h6` (lib/theme/style-selectors.ts), so a heading inherits the
//     tenant's type scale with no CSS of its own here.
//
// Extends the built-in `text` type, so it is editable on the canvas and routes
// through the ProseMirror inline schema like every other editable leaf (see
// lib/plugins/rte/prosemirror-rte.ts). `isComponent` requires the `.tc-heading`
// marker class — plain `<h2>`s inside patterns keep the behavior they have.

import type { Component, ComponentView, Editor, Plugin } from "grapesjs"

export const HEADING_TYPE = "tc-heading"

const TYPE_CLASS = "tc-heading"

/** Heading levels, largest first — the order the "Size" control lists them in. */
export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const

export type HeadingLevel = (typeof HEADING_LEVELS)[number]

const DEFAULT_LEVEL: HeadingLevel = 2

/**
 * Labels follow WordPress's heading-level control, with the word "Heading" kept
 * in front: the toolbar shows the picked value next to unrelated controls, and
 * a bare "Two" there says nothing. One definition, shared by the trait and the
 * toolbar so the two can't drift.
 */
export const HEADING_LEVEL_LABELS: Record<HeadingLevel, string> = {
  1: "Heading One",
  2: "Heading Two",
  3: "Heading Three",
  4: "Heading Four",
  5: "Heading Five",
  6: "Heading Six",
}

const isLevel = (value: number): value is HeadingLevel =>
  (HEADING_LEVELS as readonly number[]).includes(value)

/** Coerce anything the trait or parsed markup hands us into a valid level. */
export const toHeadingLevel = (value: unknown): HeadingLevel => {
  const n = Number(value)
  return isLevel(n) ? n : DEFAULT_LEVEL
}

/** The component's current level, read off its own `level` property. */
export const headingLevel = (component: Component): HeadingLevel =>
  toHeadingLevel(component.get("level"))

export const isHeading = (component: Component | null | undefined): boolean =>
  component?.get("type") === HEADING_TYPE

// Fired on the component model at the end of GrapesJS' disable-editing pass,
// once the edited content has been synced back into the model
// (ComponentTextView.toggleEvents → `model.trigger(rteEvents.disable)`).
const RTE_DISABLE_EVENT = "rte:disable"

// Fired on the component model each time one of its views finishes rendering
// (ComponentView.postRender → `model.emitWithEditor(...)`).
const RENDER_EVENT = "component:render"

/**
 * Set a heading's level from outside the Trait Manager.
 *
 * Changing the level changes `tagName`, which makes GrapesJS re-render the
 * element — and while the heading is being edited, that element is the one
 * ProseMirror is mounted on. So when this heading is the component in edit:
 *
 *  1. end the session, and wait for `rte:disable` — GrapesJS syncs the edited
 *     content back into the model during that pass, so applying the level any
 *     earlier would race the sync;
 *  2. apply the level, and hand editing to whichever view the re-render
 *     produces. The re-render is asynchronous and builds a *fresh*
 *     ComponentView, so activating the view we already have does nothing.
 *     This is the same `once(render)` handoff GrapesJS' own
 *     `addSelected({ activate: true })` uses.
 */
export const setHeadingLevel = (
  editor: Editor,
  component: Component,
  level: HeadingLevel
): void => {
  if (headingLevel(component) === level) return
  if (editor.getEditing() !== component) {
    component.set("level", level)
    return
  }
  component.once(RTE_DISABLE_EVENT, () => {
    component.once(RENDER_EVENT, ({ view }: { view: ComponentView }) =>
      view.onActive()
    )
    component.set("level", level)
  })
  component.trigger("disable")
}

type HeadingModel = Component & { syncTagName(): void }

// Block-Manager thumbnail — a capital "H" with the two crossbars.
const ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4v16M18 4v16M6 12h12"/></svg>`

export const headingPlugin: Plugin = (editor: Editor): void => {
  editor.Components.addType(HEADING_TYPE, {
    extend: "text",
    isComponent: (el) =>
      /^h[1-6]$/.test(el.tagName?.toLowerCase() ?? "") &&
      el.classList?.contains(TYPE_CLASS) === true,
    model: {
      defaults: {
        name: "Heading",
        tagName: `h${DEFAULT_LEVEL}`,
        classes: [TYPE_CLASS],
        // The heading is a single editable text run; nothing drops inside.
        droppable: false,
        level: DEFAULT_LEVEL,
        traits: [
          {
            type: "select",
            name: "level",
            label: "Size",
            changeProp: true,
            options: HEADING_LEVELS.map((level) => ({
              id: String(level),
              label: HEADING_LEVEL_LABELS[level],
            })),
          },
        ],
      },
      init(this: HeadingModel) {
        // Parsed HTML replaces the default class list wholesale (GrapesJS
        // `initClasses`), so re-assert the marker and read the level back off
        // the tag the markup actually carries.
        this.addClass(TYPE_CLASS)
        const tag = String(this.get("tagName") ?? "").toLowerCase()
        this.set("level", toHeadingLevel(tag.slice(1)))
        this.on("change:level", this.syncTagName)
      },
      syncTagName(this: HeadingModel) {
        // The select trait writes the option id, a string — normalize `level`
        // back to a number here so the saved project JSON only ever holds one
        // shape. The re-entrant `change:level` this causes settles immediately
        // (the coerced value equals itself).
        const level = headingLevel(this)
        this.set({ level, tagName: `h${level}` })
      },
    },
  })

  editor.Blocks.add(HEADING_TYPE, {
    label: "Heading",
    category: "Basic",
    media: ICON,
    select: true,
    content: { type: HEADING_TYPE, content: "Insert your heading here" },
  })
}

export default headingPlugin
