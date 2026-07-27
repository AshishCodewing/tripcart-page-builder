// Style Manager sector definitions for the GrapesJS editor. Pure config —
// these drive what CSS the custom Style Manager (style-settings.tsx) exposes.
// Strings are buildProps shorthand resolved through GrapesJS' built-in
// property registry; `{ extend: 'name', ... }` tweaks a built-in; a fully
// defined object introduces a custom property.

import type { EditorConfig, PropertyStack } from "grapesjs"

import { lengthProp } from "../style-fields/length-props"
import { layoutSector } from "../style-config/layout-sector"
import { transformProp } from "../style-config/transform-prop"

type StyleSectors = NonNullable<
  NonNullable<EditorConfig["styleManager"]>["sectors"]
>

const OVERFLOW_OPTIONS = [
  { id: "visible" },
  { id: "hidden" },
  { id: "scroll" },
  { id: "auto" },
  { id: "clip" },
]

// Default GrapesJS layer labels for built-in stacks (box-shadow, text-shadow,
// transition) join raw sub-property values without their units — so a fresh
// shadow renders as "0 0 0 0" even though the popover inputs show "0px 0px
// 0px 0px". `getStyleFromLayer(layer, { number: {} })` opts into unit
// composition (grapes.mjs:62942-62946) so the row label matches the inputs.
function composedLayerLabel(
  layer: Parameters<PropertyStack["getStyleFromLayer"]>[0],
  { property }: { property: PropertyStack }
): string {
  const style = property.getStyleFromLayer(layer, { number: {} })
  return String(style[property.getName()] ?? "")
}

export const STYLE_SECTORS: StyleSectors = [
  layoutSector,
  {
    id: "size",
    name: "Size",
    open: false,
    properties: [
      lengthProp("width", { extend: "width" }),
      lengthProp("height", { extend: "height" }),
      lengthProp("min-width", { extend: "min-width" }),
      lengthProp("min-height", { extend: "min-height" }),
      lengthProp("max-width", { extend: "max-width" }),
      lengthProp("max-height", { extend: "max-height" }),
    ],
  },
  {
    id: "position",
    name: "Position",
    open: false,
    properties: [
      {
        property: "position",
        type: "select",
        default: "static",
        options: [
          { id: "static" },
          { id: "relative" },
          { id: "absolute" },
          { id: "fixed" },
          { id: "sticky" },
        ],
      },
      lengthProp("top", { extend: "top" }),
      lengthProp("right", { extend: "right" }),
      lengthProp("bottom", { extend: "bottom" }),
      lengthProp("left", { extend: "left" }),
      { extend: "z-index", type: "integer" },
    ],
  },
  {
    id: "spacing",
    name: "Spacing",
    open: false,
    properties: [
      {
        extend: "margin",
        type: "composite",
        properties: [
          lengthProp("margin-top", { default: "0" }),
          lengthProp("margin-right", { default: "0" }),
          lengthProp("margin-bottom", { default: "0" }),
          lengthProp("margin-left", { default: "0" }),
        ],
      },
      {
        extend: "padding",
        type: "composite",
        properties: [
          lengthProp("padding-top", { default: "0" }),
          lengthProp("padding-right", { default: "0" }),
          lengthProp("padding-bottom", { default: "0" }),
          lengthProp("padding-left", { default: "0" }),
        ],
      },
    ],
  },
  {
    id: "typography",
    name: "Typography",
    open: false,
    properties: [
      "font-family",
      "color",
      lengthProp("font-size", { extend: "font-size" }),
      "font-weight",
      lengthProp("line-height", { extend: "line-height" }),
      lengthProp("letter-spacing", { extend: "letter-spacing" }),
      {
        property: "font-style",
        type: "radio",
        options: [{ id: "normal" }, { id: "italic" }],
      },
      "text-align",
      {
        property: "text-transform",
        type: "radio",
        options: [
          { id: "none" },
          { id: "capitalize" },
          { id: "uppercase" },
          { id: "lowercase" },
        ],
      },
      {
        property: "text-decoration",
        type: "radio",
        options: [
          { id: "none" },
          { id: "underline" },
          { id: "overline" },
          { id: "line-through" },
        ],
      },
      {
        property: "white-space",
        type: "select",
        options: [
          { id: "normal" },
          { id: "nowrap", label: "No wrap" },
          { id: "pre" },
          { id: "pre-wrap" },
          { id: "pre-line" },
        ],
      },
      {
        property: "text-wrap",
        type: "select",
        options: [
          { id: "wrap" },
          { id: "nowrap", label: "No wrap" },
          { id: "balance" },
          { id: "pretty" },
          { id: "stable" },
        ],
      },
    ],
  },
  {
    id: "background",
    name: "Background",
    open: false,
    properties: ["background", "background-color"],
  },
  {
    id: "border",
    name: "Border",
    open: false,
    properties: [
      "border",
      {
        extend: "border-radius",
        type: "composite",
        properties: [
          lengthProp("border-top-left-radius", { default: "0" }),
          lengthProp("border-top-right-radius", { default: "0" }),
          lengthProp("border-bottom-right-radius", { default: "0" }),
          lengthProp("border-bottom-left-radius", { default: "0" }),
        ],
      },
    ],
  },
  {
    id: "effects",
    name: "Effects",
    open: false,
    properties: [
      "opacity",
      "cursor",
      { extend: "box-shadow", layerLabel: composedLayerLabel },
      { extend: "text-shadow", layerLabel: composedLayerLabel },
      "filter",
      { extend: "filter", property: "backdrop-filter" },
      { extend: "transition", layerLabel: composedLayerLabel },
      transformProp,
      {
        property: "overflow",
        type: "composite",
        default: "visible",
        properties: [
          {
            property: "overflow-x",
            type: "select",
            default: "visible",
            options: OVERFLOW_OPTIONS,
          },
          {
            property: "overflow-y",
            type: "select",
            default: "visible",
            options: OVERFLOW_OPTIONS,
          },
        ],
      },
    ],
  },
]
