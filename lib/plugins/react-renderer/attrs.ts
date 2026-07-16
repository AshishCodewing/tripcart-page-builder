// Convert a GrapesJS attribute bag into React props. Most HTML attributes pass
// through; a curated set is normalized to camelCase (so React doesn't warn),
// SVG context flips on full camelCase, and `style` is parsed via style.ts.

import { kebabToCamel, normalizeStyleObject } from "./style"

// HTML/SVG attribute name → React prop name (the few cases where mechanical
// kebab→camel isn't enough). Includes lowercased single-word HTML attributes
// that React expects in camelCase (e.g. `frameborder` → `frameBorder`).
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
  // HTML one-word attributes React expects camelCased.
  frameborder: "frameBorder",
  marginheight: "marginHeight",
  marginwidth: "marginWidth",
  allowfullscreen: "allowFullScreen",
  allowtransparency: "allowTransparency",
  referrerpolicy: "referrerPolicy",
  tabindex: "tabIndex",
  colspan: "colSpan",
  rowspan: "rowSpan",
  crossorigin: "crossOrigin",
  srcset: "srcSet",
  srclang: "srcLang",
  srcdoc: "srcDoc",
  usemap: "useMap",
  accesskey: "accessKey",
  contenteditable: "contentEditable",
  inputmode: "inputMode",
  spellcheck: "spellCheck",
  autoplay: "autoPlay",
  playsinline: "playsInline",
  controlslist: "controlsList",
  disablepictureinpicture: "disablePictureInPicture",
  disableremoteplayback: "disableRemotePlayback",
  enctype: "encType",
  formaction: "formAction",
  formenctype: "formEncType",
  formmethod: "formMethod",
  formnovalidate: "formNoValidate",
  formtarget: "formTarget",
  novalidate: "noValidate",
  readonly: "readOnly",
  maxlength: "maxLength",
  minlength: "minLength",
  autofocus: "autoFocus",
  autocomplete: "autoComplete",
  // Single-word (hyphen-less) HTML attributes React expects camelCased. These
  // can't be fixed by the mechanical kebab→camel step because they contain no
  // hyphen, so they must be listed explicitly or React warns (e.g. `datetime`
  // on <time>, `hreflang` on <a>, `cellpadding` on <table>).
  datetime: "dateTime",
  hreflang: "hrefLang",
  cellpadding: "cellPadding",
  cellspacing: "cellSpacing",
  charset: "charSet",
  autocapitalize: "autoCapitalize",
  autocorrect: "autoCorrect",
  enterkeyhint: "enterKeyHint",
  radiogroup: "radioGroup",
  contextmenu: "contextMenu",
  itemid: "itemID",
  itemprop: "itemProp",
  itemref: "itemRef",
  itemscope: "itemScope",
  itemtype: "itemType",
  nomodule: "noModule",
  popovertarget: "popoverTarget",
  popovertargetaction: "popoverTargetAction",
  fetchpriority: "fetchPriority",
  imagesizes: "imageSizes",
  imagesrcset: "imageSrcSet",
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
  "role",
])

// Boolean HTML attributes whose value can legitimately be `false`. Every other
// attribute receiving `false` from GrapesJS means "not set" and should be
// omitted so React doesn't warn about passing false to a DOM attribute.
const BOOLEAN_HTML_ATTRS = new Set([
  "disabled",
  "checked",
  "selected",
  "multiple",
  "required",
  "readonly",
  "autofocus",
  "allowfullscreen",
  "novalidate",
  "autoplay",
  "controls",
  "loop",
  "muted",
  "playsinline",
  "default",
  "defer",
  "async",
  "hidden",
  "open",
  "reversed",
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
    // GrapesJS stores `false` for unset non-boolean attributes (e.g. `target`
    // on a link with no target set). Passing false to a DOM attribute triggers
    // a React warning, so skip it; only boolean HTML attributes keep false.
    if (value === false && !BOOLEAN_HTML_ATTRS.has(key)) continue

    if (key === "style") {
      out.style = normalizeStyleObject(value)
      continue
    }
    if (key.startsWith("data-")) {
      out[key] = value
      continue
    }
    // Explicit map entries are React-recognized prop names — always use them.
    if (ATTR_CASE_MAP[key]) {
      out[ATTR_CASE_MAP[key]] = value
      continue
    }
    // aria-* must be tested on the ORIGINAL key (kebabToCamel collapses the
    // hyphen) and BEFORE the SVG branch: React requires hyphenated aria-*
    // props on SVG and HTML alike — `ariaHidden` triggers a warning.
    if (key.startsWith("aria-")) {
      out[key] = value
      continue
    }
    const camel = kebabToCamel(key)
    if (isSvgContext || SVG_PROPS.has(camel) || camel.startsWith("svg")) {
      out[camel] = value
      continue
    }
    if (!STANDARD_REACT_PROPS.has(camel) && !camel.startsWith("on")) {
      // Unknown attribute: leave the original (likely kebab) key so it lands
      // on the DOM verbatim instead of becoming an unknown camelCase prop.
      out[key] = value
    } else {
      out[camel] = value
    }
  }

  return out
}
