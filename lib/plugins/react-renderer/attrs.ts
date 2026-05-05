// Convert a GrapesJS attribute bag into React props. Most HTML attributes pass
// through; a curated set is normalized to camelCase (so React doesn't warn),
// SVG context flips on full camelCase, and `style` is parsed via style.ts.

import { kebabToCamel, normalizeStyleObject } from "./style"

// HTML/SVG attribute name → React prop name (the few cases where mechanical
// kebab→camel isn't enough).
const ATTR_CASE_MAP: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  "http-equiv": "httpEquiv",
  "accept-charset": "acceptCharset",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
  "stroke-miterlimit": "strokeMiterlimit",
  "stroke-dasharray": "strokeDasharray",
  "stroke-opacity": "strokeOpacity",
  "fill-opacity": "fillOpacity",
  "font-family": "fontFamily",
  "font-size": "fontSize",
  "text-anchor": "textAnchor",
}

// Common HTML props that React treats as camelCase.
const STANDARD_REACT_PROPS = new Set([
  "className",
  "id",
  "style",
  "href",
  "src",
  "alt",
  "title",
  "target",
  "rel",
  "type",
  "name",
  "value",
  "placeholder",
  "onClick",
  "onChange",
  "onSubmit",
  "onBlur",
  "onFocus",
  "disabled",
  "readOnly",
  "checked",
  "selected",
  "multiple",
  "width",
  "height",
  "maxLength",
  "min",
  "max",
  "step",
  "rows",
  "cols",
  "autoComplete",
  "autoFocus",
  "required",
  "spellCheck",
  "tabIndex",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "role",
])

// Camel-cased SVG props (after kebab→camel) that, if present, mark this attr
// bag as SVG-rendered and trigger camelCase conversion across the bag.
const SVG_PROPS = new Set([
  "x",
  "y",
  "d",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x1",
  "x2",
  "y1",
  "y2",
  "points",
  "fill",
  "stroke",
  "strokeWidth",
  "strokeLinecap",
  "strokeLinejoin",
  "strokeDasharray",
  "strokeOpacity",
  "fillOpacity",
  "fillRule",
  "clipRule",
  "transform",
  "viewBox",
  "preserveAspectRatio",
  "pathLength",
  "vectorEffect",
  "dominantBaseline",
  "alignmentBaseline",
  "textAnchor",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "textDecoration",
  "baselineShift",
  "opacity",
  "mask",
  "clipPath",
  "overflow",
  "pointerEvents",
])

const htmlAttrToReactProp = (attr: string): string =>
  ATTR_CASE_MAP[attr] ?? kebabToCamel(attr)

export const attrsToReactProps = (
  attrs: Record<string, unknown>
): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  const xmlns =
    typeof attrs.xmlns === "string" ? (attrs.xmlns as string) : undefined
  const isSvgContext =
    !!xmlns?.includes("svg") ||
    attrs.viewBox !== undefined ||
    attrs.d !== undefined

  for (const [key, value] of Object.entries(attrs)) {
    if (key === "style") {
      out.style = normalizeStyleObject(value)
      continue
    }
    if (key.startsWith("data-")) {
      out[key] = value
      continue
    }
    const camel = htmlAttrToReactProp(key)
    if (isSvgContext || SVG_PROPS.has(camel) || camel.startsWith("svg")) {
      out[camel] = value
      continue
    }
    if (
      !STANDARD_REACT_PROPS.has(camel) &&
      !camel.startsWith("on") &&
      !camel.startsWith("aria-") &&
      !camel.startsWith("data-")
    ) {
      // Unknown attribute: leave the original (likely kebab) key so it lands
      // on the DOM verbatim instead of becoming an unknown camelCase prop.
      out[key] = value
    } else {
      out[camel] = value
    }
  }

  return out
}
