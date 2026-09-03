// What the style book shows: one entry per themeable block, each with the
// specimens that demonstrate it.
//
// Specimen markup is the markup a dropped block produces:
//   - Button carries `tc-button tc-element-button` (+ `is-style-outline` for
//     the variation) exactly as `lib/plugins/button` sets them.
//   - Tabs uses the canonical shape from `lib/plugins/interactive/tags.ts`;
//     the web component self-heals ids, aria-* and hidden at runtime.
//
// Pure data with no GrapesJS import, so a server component can build the
// iframe document from it.

import type { ElementName } from "@/lib/theme/schema"

export type Specimen = {
  id: string
  label: string
  html: string
  /** Element variation this specimen demonstrates; absent = the base look. */
  variation?: string
}

export type StyleBookEntry =
  | {
      id: string
      kind: "element"
      label: string
      name: ElementName
      variations: readonly { slug: string; label: string }[]
      specimens: readonly Specimen[]
    }
  | {
      id: string
      kind: "component"
      label: string
      type: string
      specimens: readonly Specimen[]
    }

const tabsSpecimen = [
  "<tc-tabs>",
  '  <div role="tablist">',
  '    <button role="tab"><span>Overview</span></button>',
  '    <button role="tab"><span>Itinerary</span></button>',
  '    <button role="tab"><span>Pricing</span></button>',
  "  </div>",
  '  <div class="tc-tabs__panels">',
  '    <div role="tabpanel"><p>What the trip covers, at a glance.</p></div>',
  '    <div role="tabpanel"><p>Day by day, from arrival to departure.</p></div>',
  '    <div role="tabpanel"><p>What is included and what costs extra.</p></div>',
  "  </div>",
  "</tc-tabs>",
].join("\n")

export const STYLE_BOOK_ENTRIES: readonly StyleBookEntry[] = [
  {
    id: "button",
    kind: "element",
    label: "Button",
    name: "button",
    variations: [
      { slug: "", label: "Default" },
      { slug: "outline", label: "Outline" },
    ],
    specimens: [
      {
        id: "button-fill",
        label: "Default",
        html: '<a class="tc-button tc-element-button">Book now</a>',
      },
      {
        id: "button-outline",
        label: "Outline",
        variation: "outline",
        html: '<a class="tc-button tc-element-button is-style-outline">Book now</a>',
      },
    ],
  },
  {
    id: "tabs",
    kind: "component",
    label: "Tabs",
    type: "tc-tabs",
    specimens: [{ id: "tabs", label: "Tabs", html: tabsSpecimen }],
  },
]

export const getStyleBookEntry = (
  id: string | null
): StyleBookEntry | undefined =>
  id ? STYLE_BOOK_ENTRIES.find((entry) => entry.id === id) : undefined

/** The specimen to highlight for an entry, given the selected variation. */
export const specimenIdFor = (
  entry: StyleBookEntry,
  variation: string | null
): string | undefined => {
  const wanted = variation ?? ""
  const match = entry.specimens.find((s) => (s.variation ?? "") === wanted)
  return (match ?? entry.specimens[0])?.id
}

export const findSpecimen = (
  id: string
): { entry: StyleBookEntry; specimen: Specimen } | undefined => {
  for (const entry of STYLE_BOOK_ENTRIES) {
    const specimen = entry.specimens.find((s) => s.id === id)
    if (specimen) return { entry, specimen }
  }
  return undefined
}

export const SPECIMEN_ATTR = "data-specimen"
export const SELECTED_ATTR = "data-selected"
/** Set on the elements a component part's selector matches, inside the selected specimen. */
export const SELECTED_PART_ATTR = "data-selected-part"

/**
 * Canvas contents for the style book: one section per specimen, tagged so a
 * click can be mapped back to its entry and so the selected one can be
 * outlined. Labels are `<div>`s — the theme styles `h1`–`h6` globally, and a
 * heading here would restyle itself as the user edits.
 */
export const styleBookHtml = (): string =>
  STYLE_BOOK_ENTRIES.flatMap((entry) =>
    entry.specimens.map((specimen) =>
      [
        `<section ${SPECIMEN_ATTR}="${specimen.id}">`,
        `<div class="tc-book-label">${entry.label} — ${specimen.label}</div>`,
        specimen.html,
        "</section>",
      ].join("")
    )
  ).join("\n")
