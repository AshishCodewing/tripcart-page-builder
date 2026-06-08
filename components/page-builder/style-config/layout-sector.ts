import type { PropertyCompositeProps } from "grapesjs"

import { lengthProp } from "../style-fields/length-props"

// Columns / Rows share the same composite shape — only the property name
// (`grid-template-columns` vs `grid-template-rows`) and label differ. The
// synthetic sub-properties (`-mode`, `-repeat`, `-min`, `-max`) decompose the
// CSS shorthand `repeat(N, minmax(min, max))` (or the auto-fit variant) into
// editable fields. Studio SDK's `Ea()` factory is the precedent.
//
// Two emitted shapes:
//   fixed:     repeat(N, minmax(min, max))
//   auto-fit:  repeat(auto-fit, minmax(min(min, 100%), max))
// The `min(min, 100%)` wrap on auto-fit/auto-fill prevents items from
// overflowing on viewports narrower than the configured min track size.
function gridTrackComposite(
  property: "grid-template-columns" | "grid-template-rows",
  label: "Columns" | "Rows"
): PropertyCompositeProps {
  const modeProp = `${property}-mode`
  const repeatProp = `${property}-repeat`
  const minProp = `${property}-min`
  const maxProp = `${property}-max`

  return {
    property,
    type: "composite",
    label,
    default: "repeat(1, minmax(0, 1fr))",
    properties: [
      {
        property: modeProp,
        type: "select",
        default: "fixed",
        options: [
          { id: "fixed", label: "Fixed" },
          { id: "auto-fit", label: "Auto-fit" },
          { id: "auto-fill", label: "Auto-fill" },
        ],
      },
      {
        property: repeatProp,
        type: "integer",
        default: "1",
        min: 1,
      },
      lengthProp(minProp, { default: "0" }),
      lengthProp(maxProp, { default: "1", unit: "fr" }),
    ],
    toStyle: (values, { name }) => {
      const mode = values[modeProp] || "fixed"
      const min = values[minProp] || "0"
      const max = values[maxProp] || "1fr"
      if (mode === "auto-fit" || mode === "auto-fill") {
        return {
          [name]: `repeat(${mode}, minmax(min(${min}, 100%), ${max}))`,
        }
      }
      const n = values[repeatProp] || "1"
      return { [name]: `repeat(${n}, minmax(${min}, ${max}))` }
    },
    fromStyle: (style, { name }) => {
      const val = String(style[name] ?? "")
      const autoMatch = val.match(
        /^repeat\(\s*(auto-fit|auto-fill)\s*,\s*minmax\(\s*min\(\s*([^,]+?)\s*,\s*100%\s*\)\s*,\s*([^)]+?)\s*\)\s*\)$/i
      )
      if (autoMatch) {
        return {
          [modeProp]: autoMatch[1],
          [minProp]: autoMatch[2].trim(),
          [maxProp]: autoMatch[3].trim(),
        }
      }
      const fixedMatch = val.match(
        /^repeat\(\s*(\d+)\s*,\s*minmax\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)\s*\)$/i
      )
      if (fixedMatch) {
        return {
          [modeProp]: "fixed",
          [repeatProp]: fixedMatch[1],
          [minProp]: fixedMatch[2].trim(),
          [maxProp]: fixedMatch[3].trim(),
        }
      }
      return {}
    },
  }
}

// Grid child shorthand: `row-start / column-start / row-end / column-end`.
// `fixedValues: ["auto"]` lets the integer inputs round-trip the `auto`
// keyword via NumberField (parseValueShape treats it as kind="fixed").
const gridAreaComposite: PropertyCompositeProps = {
  property: "grid-area",
  type: "composite",
  label: "Grid area",
  default: "auto / auto / auto / auto",
  properties: [
    {
      property: "grid-row-start",
      type: "integer",
      default: "auto",
      fixedValues: ["auto"],
    },
    {
      property: "grid-row-end",
      type: "integer",
      default: "auto",
      fixedValues: ["auto"],
    },
    {
      property: "grid-column-start",
      type: "integer",
      default: "auto",
      fixedValues: ["auto"],
    },
    {
      property: "grid-column-end",
      type: "integer",
      default: "auto",
      fixedValues: ["auto"],
    },
  ],
  toStyle: (v, { name }) => {
    const rs = v["grid-row-start"] || "auto"
    const cs = v["grid-column-start"] || "auto"
    const re = v["grid-row-end"] || "auto"
    const ce = v["grid-column-end"] || "auto"
    return { [name]: `${rs} / ${cs} / ${re} / ${ce}` }
  },
  fromStyle: (style, { name }) => {
    const parts = String(style[name] ?? "")
      .split("/")
      .map((s) => s.trim())
    if (parts.length !== 4) return {}
    const [rs, cs, re, ce] = parts
    return {
      "grid-row-start": rs,
      "grid-column-start": cs,
      "grid-row-end": re,
      "grid-column-end": ce,
    }
  },
}

// Layout sector — display, flex container/child, grid container/child.
//
// Ordering: structure → spacing → container alignment → item alignment,
// then child overrides. Each field's visibility is gated by
// `components/page-builder/style-fields/visibility.ts`; this array drives the
// visual order users see. Custom render branches for the composites live in
// `style-fields/composite-field.tsx`, keyed by property name.
export const layoutSector = {
  id: "layout",
  name: "Layout",
  open: true,
  properties: [
    // ───── Container ───────────────────────────────────────────────
    // Built-in display list extended to include grid + inline-grid so the
    // sector can branch between flex-container, grid-container, and plain
    // block fields (visibility.ts gates the dependent rows).
    {
      extend: "display",
      type: "select",
      default: "block",
      options: [
        { id: "block" },
        { id: "flex" },
        { id: "grid" },
        { id: "inline" },
        { id: "inline-block" },
        { id: "none" },
      ],
    },
    // Flex container structure — gated to display: flex by visibility.ts.
    // Override to `radio` so RadioField picks up the icon set in
    // option-icons.ts (the GrapesJS built-in is a `select` dropdown).
    { extend: "flex-direction", type: "radio" },
    "flex-wrap",
    // Grid container structure.
    gridTrackComposite("grid-template-columns", "Columns"),
    gridTrackComposite("grid-template-rows", "Rows"),
    // `gap` shorthand expanded into row-gap / column-gap so the custom
    // GapField can edit each axis independently. Visible for both flex and
    // grid containers.
    {
      property: "gap",
      type: "composite",
      default: "0px",
      properties: [
        lengthProp("row-gap", { default: "0" }),
        lengthProp("column-gap", { default: "0" }),
      ],
    },
    // Container alignment — track distribution (content) then item
    // distribution (items). The `requires` override is critical: GrapesJS's
    // built-in property tree chains `requires: { display: ['flex'] }` through
    // these props, so without overriding it `property.isVisible()` returns
    // false on grid containers and PropertyField bails before visibility.ts
    // runs.
    {
      extend: "justify-content",
      type: "radio",
      requires: { display: ["flex", "grid"] },
    },
    {
      extend: "align-content",
      type: "radio",
      requires: { display: ["flex", "grid"] },
    },
    // Grid-only — default alignment of items within their cells along the
    // inline axis. Rendered as `radio` so RadioField picks up the horizontal
    // icon set in option-icons.ts.
    {
      property: "justify-items",
      type: "radio",
      default: "stretch",
      options: [
        { id: "start" },
        { id: "center" },
        { id: "end" },
        { id: "stretch" },
      ],
    },
    {
      extend: "align-items",
      type: "radio",
      requires: { display: ["flex", "grid"] },
    },
    // ───── Child ───────────────────────────────────────────────────
    // align-self applies to both flex items and grid items; the built-in
    // sets `requiresParent: { display: ['flex'] }` which we widen here.
    {
      extend: "align-self",
      type: "radio",
      requiresParent: { display: ["flex", "grid"] },
    },
    // Grid-only child — alignment of this item within its cell along the
    // inline axis. Mirrors justify-items (horizontal icon set, same option
    // order).
    {
      property: "justify-self",
      type: "radio",
      default: "stretch",
      options: [
        { id: "start" },
        { id: "center" },
        { id: "end" },
        { id: "stretch" },
      ],
    },
    {
      extend: "order",
      type: "integer",
      default: "0",
    },
    // Composite that backs the Flex preset radio (Auto / Fill / Hug). The
    // preset UI lives in property-field.tsx → FlexPresetField; the
    // sub-properties below are also surfaced for power users who want to
    // type exact grow/shrink/basis values.
    {
      property: "flex",
      type: "composite",
      default: "0 0 auto",
      properties: [
        {
          property: "flex-grow",
          type: "integer",
          default: "0",
          min: 0,
        },
        {
          property: "flex-shrink",
          type: "integer",
          default: "0",
          min: 0,
        },
        lengthProp("flex-basis", { default: "auto" }),
      ],
    },
    gridAreaComposite,
  ],
}
