import type {
  PropertyNumber,
  PropertySelect,
  PropertyStackProps,
  SelectOption,
} from "grapesjs"

import { LENGTH_FIXED_VALUES } from "../style-fields/length-props"

// Override of the built-in `transform` stack (grapes.mjs:65282-65359). Two
// upstream defects make it crash or corrupt real-world values:
//
// 1. `transform-type` ships only eight options (scaleX/Y/Z, rotateX/Y/Z,
//    translateX/Y) and its `onChange` dereferences `property.getOption()`
//    without a null check. `getOption()` returns `null` when the current
//    value isn't in the list (grapes.mjs:64276), so selecting a layer for
//    any other function — `scale()`, `rotate()`, `translate()`, all of which
//    our pattern CSS emits — throws "can't access property propValue,
//    option is null".
// 2. `fromStyle` splits the CSS value on the raw layer separator (a single
//    space), which shatters functions that contain spaces inside their
//    parens: `scale(var(--trip-card-image-scale, 1))` becomes the two bogus
//    layers `scale(var(--trip-card-image-scale,` and `1))`.
//
// So we keep the built-in `toStyle` and replace the option list, the parser,
// and the change handler.

const UNITS_NONE = [""]
const UNITS_ANGLE = ["deg", "rad", "grad", "turn"]
const UNITS_SIZE = ["px", "%", "em", "rem", "vh", "vw"]

// Single-argument transform functions, which are the ones the Type select +
// single value field can round-trip. Multi-argument functions (`matrix()`,
// `translate3d()`, …) are deliberately absent — they still parse into a
// layer and still render, the Type select just shows no match, and the
// null-safe `onChange` below keeps that from throwing.
const TRANSFORM_OPTIONS: SelectOption[] = [
  { id: "scale", propValue: { units: UNITS_NONE, step: 0.01 } },
  { id: "scaleX", propValue: { units: UNITS_NONE, step: 0.01 } },
  { id: "scaleY", propValue: { units: UNITS_NONE, step: 0.01 } },
  { id: "scaleZ", propValue: { units: UNITS_NONE, step: 0.01 } },
  { id: "rotate", propValue: { units: UNITS_ANGLE, step: 1 } },
  { id: "rotateX", propValue: { units: UNITS_ANGLE, step: 1 } },
  { id: "rotateY", propValue: { units: UNITS_ANGLE, step: 1 } },
  { id: "rotateZ", propValue: { units: UNITS_ANGLE, step: 1 } },
  { id: "translateX", propValue: { units: UNITS_SIZE, step: 1 } },
  { id: "translateY", propValue: { units: UNITS_SIZE, step: 1 } },
  { id: "translateZ", propValue: { units: UNITS_SIZE, step: 1 } },
  { id: "skewX", propValue: { units: UNITS_ANGLE, step: 1 } },
  { id: "skewY", propValue: { units: UNITS_ANGLE, step: 1 } },
  { id: "perspective", propValue: { units: UNITS_SIZE, step: 1 } },
]

// Split a transform value into its function calls, ignoring whitespace that
// sits inside parens — `translate(-50%, -50%) rotate(3deg)` is two layers,
// `scale(var(--x, 1))` is one.
export function splitTransformLayers(value: string): string[] {
  const layers: string[] = []
  let depth = 0
  let buffer = ""

  for (const char of value) {
    if (char === "(") depth += 1
    if (char === ")") depth = Math.max(0, depth - 1)
    if (depth === 0 && /\s/.test(char)) {
      if (buffer) layers.push(buffer)
      buffer = ""
      continue
    }
    buffer += char
  }
  if (buffer) layers.push(buffer)

  // Keyword values (`none`, `inherit`, …) aren't layers — a component with
  // `transform: none` has nothing to list.
  return layers.filter((layer) => layer.includes("("))
}

export const transformProp: PropertyStackProps & { extend: string } = {
  extend: "transform",
  fromStyle: (style, { property, name }) =>
    splitTransformLayers(String(style[name] ?? "")).map((input) => {
      const { name: fn, value } = property.__parseFn(input)
      return { "transform-type": fn, "transform-value": value }
    }) as unknown as ReturnType<NonNullable<PropertyStackProps["fromStyle"]>>,
  properties: [
    {
      property: "transform-type",
      name: "Type",
      type: "select",
      default: "translateY",
      full: true,
      options: TRANSFORM_OPTIONS,
      onChange: ({ property, to }) => {
        if (!to.value) return
        const option = (property as PropertySelect).getOption()
        // Unknown function (`matrix()`, a typo, an empty parse) — leave the
        // value field's units alone rather than throwing.
        if (!option) return

        const target = property.getParent()?.getProperty("transform-value") as
          | PropertyNumber
          | undefined
        if (!target) return

        const props: { units?: string[]; step?: number; unit?: string } = {
          ...option.propValue,
        }
        const units = props.units ?? []
        const unit = target.getUnit()
        if (!unit || !units.includes(unit)) props.unit = units[0] ?? ""
        // `up()` is typed against PropertyProps, which doesn't declare the
        // PropertyNumber-only `units`/`unit`/`step` keys the built-in
        // handler passes here.
        target.up(props as Parameters<PropertyNumber["up"]>[0])
      },
    },
    {
      property: "transform-value",
      type: "number",
      default: "0",
      full: true,
      // Keeps `var(--card-lift)` / `calc(…)` arguments verbatim instead of
      // letting PropertyNumber strip them down to a number. The trailing
      // entry does the same for the argument list of a multi-argument
      // function — without it `translate(-50%, -50%)` recomposes as
      // `translate(-50%)` the first time the layer is touched.
      fixedValues: [...LENGTH_FIXED_VALUES, "[^,]+,.+"],
    },
  ],
}
