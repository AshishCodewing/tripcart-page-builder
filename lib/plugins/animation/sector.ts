// The Style Manager's "Animation" sector — modeled on the Studio SDK
// animation plugin's panel: a handful of everyday controls, with the rest
// folded under "Advanced".
//
// Animations are scroll-driven: Start and End say how far into view the
// animation begins and finishes (`animation-range-*`). Type, Timing and a
// group's Stagger are the everyday rows; the rest sits under Advanced.
// Each multi-part CSS value (a range edge, the timeline) is one composite, drawn
// as one boxed group.
//
// Every property gates itself with the GrapesJS `isVisible` property option,
// and GrapesJS hides a sector none of whose properties are visible
// (StyleManager.__upProps) — so the sector only exists while an Animation or
// Animation Group is selected.
//
// `advanced: true` puts a property in the sector's "Advanced" fold
// (components/page-builder/style-fields/property-hints.ts).

import type {
  IsVisibleFn,
  PropertyCompositeProps,
  PropertyProps,
  PropertySelectProps,
  SectorProperties,
} from "grapesjs"

import { isAnimation, isAnimationGroup, isGroupedAnimation } from "./index"

type Values = Record<string, string | undefined>

// ─── Who sees what ───────────────────────────────────────────────────────────

const onAnimation: IsVisibleFn = ({ component }) => isAnimation(component)
// A grouped Animation takes its timeline and range from its group.
const onStandalone: IsVisibleFn = ({ component }) =>
  isAnimation(component) && !isGroupedAnimation(component)
const onGroup: IsVisibleFn = ({ component }) => isAnimationGroup(component)

// ─── Options ─────────────────────────────────────────────────────────────────

/**
 * Open Props keyframes (open-props.min.css): entrances and attention-seekers.
 * `tc-fade-in` stands in for Open Props' `fade-in`, which only declares `to`.
 * Exits (`fade-out`, `slide-out-*`) and `ping` are left out: they end hidden,
 * which is never what a wrapper that should stay on the page wants.
 */
export const ANIMATION_KEYFRAMES = [
  { id: "none", label: "None" },
  { id: "tc-fade-in", label: "Fade in" },
  { id: "fade-in-bloom", label: "Fade in bloom" },
  { id: "slide-in-up", label: "Slide in up" },
  { id: "slide-in-down", label: "Slide in down" },
  { id: "slide-in-left", label: "Slide in left" },
  { id: "slide-in-right", label: "Slide in right" },
  { id: "scale-up", label: "Scale up" },
  { id: "scale-down", label: "Scale down" },
  { id: "shake-x", label: "Shake x" },
  { id: "shake-y", label: "Shake y" },
  { id: "shake-z", label: "Shake z" },
  { id: "spin", label: "Spin" },
  { id: "blink", label: "Blink" },
  { id: "float", label: "Float" },
  { id: "bounce", label: "Bounce" },
  { id: "pulse", label: "Pulse" },
]

const TIMINGS = [
  { id: "linear", label: "Linear" },
  { id: "var(--ease-3)", label: "Ease" },
  { id: "var(--ease-in-3)", label: "Ease in" },
  { id: "var(--ease-out-3)", label: "Ease out" },
  { id: "var(--ease-in-out-3)", label: "Ease in out" },
  { id: "var(--ease-elastic-out-3)", label: "Elastic out" },
  { id: "var(--ease-squish-3)", label: "Squish" },
  { id: "var(--ease-spring-3)", label: "Spring" },
  { id: "var(--ease-bounce-3)", label: "Bounce" },
]

const RANGE_PHASES = [
  { id: "cover", label: "Cover" },
  { id: "contain", label: "Contain" },
  { id: "entry", label: "Entry" },
  { id: "exit", label: "Exit" },
  { id: "entry-crossing", label: "Entry crossing" },
  { id: "exit-crossing", label: "Exit crossing" },
]

const AXES = [
  { id: "block", label: "Block" },
  { id: "inline", label: "Inline" },
  { id: "y", label: "Vertical" },
  { id: "x", label: "Horizontal" },
]

// ─── Timeline ────────────────────────────────────────────────────────────────

// Every `animation-timeline` form an author can pick:
//   view(<axis> <inset>)            the element's journey through the scrollport
//   scroll(<scroller> <axis>)       a scroller's own progress
//   auto                            the document timeline — plays on page load
//   none                            no timeline — the animation doesn't run
// (A named `<dashed-ident>` timeline is left out: nothing on the page declares
// one for an author to pick, bar the group's own, which it applies itself.)
const TIMELINE_SOURCES = [
  { id: "view", label: "In view" },
  { id: "nearest", label: "Scroll: nearest scroller" },
  { id: "root", label: "Scroll: page" },
  { id: "self", label: "Scroll: itself" },
  { id: "auto", label: "Page load" },
  { id: "none", label: "None" },
]

const SCROLLERS = ["nearest", "root", "self"]
const AXIS_IDS = AXES.map((axis) => axis.id)

export type TimelineParts = {
  source: string
  axis: string
  insetStart: string
  insetEnd: string
}

const TIMELINE_DEFAULTS: TimelineParts = {
  source: "view",
  axis: "block",
  insetStart: "auto",
  insetEnd: "auto",
}

/** The `animation-timeline` value for the parts, defaults omitted. */
export const composeTimeline = (parts: Partial<TimelineParts>): string => {
  const { source, axis, insetStart, insetEnd } = {
    ...TIMELINE_DEFAULTS,
    ...parts,
  }
  if (source === "auto" || source === "none") return source
  const args: string[] = []
  if (source !== "view" && source !== "nearest") args.push(source)
  if (axis && axis !== "block") args.push(axis)
  if (source === "view") {
    const start = insetStart || "auto"
    const end = insetEnd || "auto"
    if (start !== "auto" || end !== "auto") args.push(start, end)
  }
  return `${source === "view" ? "view" : "scroll"}(${args.join(" ")})`
}

/** Inverse of `composeTimeline`; accepts any token order. */
export const parseTimeline = (value: string): TimelineParts | null => {
  const trimmed = value.trim()
  if (trimmed === "auto" || trimmed === "none") {
    return { ...TIMELINE_DEFAULTS, source: trimmed }
  }
  const match = trimmed.match(/^(view|scroll)\(([^)]*)\)$/)
  if (!match) return null
  const tokens = match[2].trim().split(/\s+/).filter(Boolean)
  const axis = tokens.find((t) => AXIS_IDS.includes(t)) ?? "block"
  if (match[1] === "scroll") {
    const scroller = tokens.find((t) => SCROLLERS.includes(t)) ?? "nearest"
    return { ...TIMELINE_DEFAULTS, source: scroller, axis }
  }
  const insets = tokens.filter((t) => !AXIS_IDS.includes(t))
  return {
    source: "view",
    axis,
    insetStart: insets[0] ?? "auto",
    // One inset value applies to both edges.
    insetEnd: insets[1] ?? insets[0] ?? "auto",
  }
}

const inset = (property: string, label: string): PropertyProps =>
  ({
    property,
    type: "number",
    label,
    default: "auto",
    units: ["%", "px"],
    unit: "%",
    fixedValues: ["auto"],
  }) as PropertyProps

const timelineProperty = {
  property: "animation-timeline",
  type: "composite",
  label: "Timeline",
  advanced: true,
  isVisible: onStandalone,
  properties: [
    {
      property: "animation-timeline-source",
      type: "select",
      label: "Driven by",
      default: "view",
      options: TIMELINE_SOURCES,
    } as PropertySelectProps,
    {
      property: "animation-timeline-axis",
      type: "select",
      label: "Axis",
      default: "block",
      options: AXES,
    } as PropertySelectProps,
    // Only `view()` takes an inset: it shrinks (or grows) the scrollport edges
    // the element's progress is measured against.
    inset("animation-timeline-inset-start", "Inset start"),
    inset("animation-timeline-inset-end", "Inset end"),
  ],
  toStyle: (values: Values) => ({
    "animation-timeline": composeTimeline({
      source: values["animation-timeline-source"],
      axis: values["animation-timeline-axis"],
      insetStart: values["animation-timeline-inset-start"],
      insetEnd: values["animation-timeline-inset-end"],
    }),
  }),
  fromStyle: (style) => {
    const parts = parseTimeline(String(style["animation-timeline"] ?? ""))
    if (!parts) return {}
    return {
      "animation-timeline-source": parts.source,
      "animation-timeline-axis": parts.axis,
      "animation-timeline-inset-start": parts.insetStart,
      "animation-timeline-inset-end": parts.insetEnd,
    }
  },
} as PropertyCompositeProps

// A group publishes a named view timeline to its children (see ./index.ts), so
// its only choices are that timeline's axis and inset — the real
// `view-timeline-axis` / `view-timeline-inset` longhands.
//
// Two GrapesJS composite rules shape this. Sub-property names are blanked in the
// style AFTER `toStyle` runs (PropertyComposite.getStyleFromProps), so no part
// may share a name with a property `toStyle` writes. And `fromStyle` only runs
// when the rule declares the composite's own name or a part's name
// (`__styleHasProps`), so the composite is named after `view-timeline-axis` and
// always writes it — an inset alone would otherwise read back as unset.
const groupTimelineProperty = {
  property: "view-timeline-axis",
  type: "composite",
  label: "Timeline",
  advanced: true,
  isVisible: onGroup,
  properties: [
    {
      property: "view-timeline-part-axis",
      type: "select",
      label: "Axis",
      default: "block",
      options: AXES,
    } as PropertySelectProps,
    inset("view-timeline-part-inset-start", "Inset start"),
    inset("view-timeline-part-inset-end", "Inset end"),
  ],
  toStyle: (values: Values) => {
    const start = values["view-timeline-part-inset-start"] || "auto"
    const end = values["view-timeline-part-inset-end"] || "auto"
    return {
      "view-timeline-axis": values["view-timeline-part-axis"] || "block",
      "view-timeline-inset":
        start === "auto" && end === "auto" ? "" : `${start} ${end}`,
    }
  },
  fromStyle: (style) => {
    const [start = "auto", end = start] = String(
      style["view-timeline-inset"] ?? ""
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    return {
      "view-timeline-part-axis": String(style["view-timeline-axis"] || "block"),
      "view-timeline-part-inset-start": start,
      "view-timeline-part-inset-end": end,
    }
  },
} as PropertyCompositeProps

// ─── Start / End ─────────────────────────────────────────────────────────────

/** `entry 0%` from a phase + offset. */
export const composeRange = (phase = "entry", offset = "0%"): string =>
  `${phase} ${offset || "0%"}`

/** Inverse of `composeRange`. A bare phase gets the edge's default offset. */
export const parseRange = (
  value: string,
  defaultOffset: string
): { phase: string; offset: string } | null => {
  const match = value
    .trim()
    .match(
      /^(cover|contain|entry-crossing|exit-crossing|entry|exit)(?:\s+(.+))?$/
    )
  if (!match) return null
  return { phase: match[1], offset: match[2]?.trim() || defaultOffset }
}

const rangeOffset = (
  property: string,
  label: string,
  fallback: string
): PropertyProps =>
  ({
    property,
    type: "number",
    label,
    // A unit folded into the default ("30%") leaves the unit select empty.
    default: String(parseFloat(fallback)),
    units: ["%", "px"],
    unit: "%",
  }) as PropertyProps

const rangePhase = (
  property: string,
  label: string,
  fallback: string
): PropertySelectProps =>
  ({
    property,
    type: "select",
    label,
    default: fallback,
    options: RANGE_PHASES,
  }) as PropertySelectProps

type Edge = "start" | "end"

const EDGE_LABEL: Record<Edge, string> = { start: "Start", end: "End" }

// A standalone Animation's range edge composes into the real property.
const rangeProperty = (
  edge: Edge,
  phase: string,
  offset: string
): PropertyCompositeProps => {
  const property = `animation-range-${edge}`
  const phaseProp = `${property}-phase`
  const offsetProp = `${property}-offset`
  return {
    property,
    type: "composite",
    label: EDGE_LABEL[edge],
    advanced: true,
    isVisible: onStandalone,
    properties: [
      rangePhase(phaseProp, "Phase", phase),
      rangeOffset(offsetProp, "Offset", offset),
    ],
    toStyle: (values: Values) => ({
      [property]: composeRange(values[phaseProp], values[offsetProp]),
    }),
    fromStyle: (style) => {
      const parsed = parseRange(String(style[property] ?? ""), offset)
      return parsed
        ? { [phaseProp]: parsed.phase, [offsetProp]: parsed.offset }
        : {}
    },
  } as PropertyCompositeProps
}

// A group's range edge is `detached`: each part writes its own custom property,
// which the grouped-child rule combines with the stagger step.
const groupRangeProperty = (
  edge: Edge,
  phase: string,
  offset: string
): PropertyCompositeProps =>
  ({
    property: `--tc-animation-range-${edge}`,
    type: "composite",
    label: EDGE_LABEL[edge],
    detached: true,
    advanced: true,
    isVisible: onGroup,
    properties: [
      rangePhase(`--tc-animation-range-${edge}-name`, "Phase", phase),
      rangeOffset(`--tc-animation-range-${edge}-offset`, "Offset", offset),
    ],
  }) as PropertyCompositeProps

// ─── Sector ──────────────────────────────────────────────────────────────────

export const ANIMATION_SECTOR: SectorProperties = {
  id: "animation",
  name: "Animation",
  open: false,
  properties: [
    // Everyday controls.
    {
      property: "animation-name",
      type: "select",
      label: "Type",
      default: "none",
      full: true,
      options: ANIMATION_KEYFRAMES,
      isVisible: onAnimation,
    } as PropertySelectProps,
    {
      property: "--tc-animation-stagger",
      type: "number",
      label: "Stagger",
      default: "10",
      units: ["%", "px"],
      unit: "%",
      min: 0,
      isVisible: onGroup,
    } as PropertyProps,
    {
      property: "animation-timing-function",
      type: "select",
      label: "Timing",
      default: "linear",
      options: TIMINGS,
      isVisible: onAnimation,
    } as PropertySelectProps,

    // Advanced.
    timelineProperty,
    groupTimelineProperty,
    rangeProperty("start", "entry", "0%"),
    rangeProperty("end", "cover", "30%"),
    groupRangeProperty("start", "entry", "0%"),
    groupRangeProperty("end", "cover", "30%"),
    {
      property: "animation-fill-mode",
      type: "select",
      label: "Fill mode",
      default: "both",
      options: [
        { id: "none", label: "None" },
        { id: "forwards", label: "Forwards" },
        { id: "backwards", label: "Backwards" },
        { id: "both", label: "Both" },
      ],
      advanced: true,
      isVisible: onAnimation,
    } as PropertySelectProps,
    {
      property: "animation-iteration-count",
      type: "integer",
      label: "Repeat",
      default: "1",
      min: 1,
      advanced: true,
      isVisible: onAnimation,
    } as PropertyProps,
    {
      property: "animation-direction",
      type: "select",
      label: "Direction",
      default: "normal",
      options: [
        { id: "normal", label: "Normal" },
        { id: "reverse", label: "Reverse" },
        { id: "alternate", label: "Alternate" },
        { id: "alternate-reverse", label: "Alternate reverse" },
      ],
      advanced: true,
      isVisible: onAnimation,
    } as PropertySelectProps,
  ],
}
