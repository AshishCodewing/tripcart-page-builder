// CSS declaration → theme path, grouped by style group.
//
// `compileBlock` (compile.ts) turns a `StyleBlock` into exactly these CSS
// declarations; this is the inverse, and it is what lets the Blocks screen read
// a GrapesJS style edit back into the theme document.
//
// The table is load-bearing in one specific way: `designSystemPlugin` re-injects
// theme rules with `CssComposer.setRule`, which REPLACES a rule's whole
// declaration map. So any property the Style Manager can set but this table
// can't store would be written to the canvas and then silently dropped on the
// next theme change. The Blocks screen's sectors (theme-style-sectors.ts) must
// therefore only list properties that appear here; the drift test pins the
// table against what the compiler emits.

import type { Path } from "@/lib/theme/style-paths"

const SIDES = ["top", "right", "bottom", "left"] as const

const boxPaths = (box: "padding" | "margin"): Record<string, Path> =>
  Object.fromEntries(
    SIDES.map((side) => [`${box}-${side}`, ["spacing", box, side]])
  )

export const CSS_TO_PATH: Record<string, Path> = {
  display: ["layout", "display"],
  "flex-direction": ["layout", "flexDirection"],
  "flex-wrap": ["layout", "flexWrap"],
  gap: ["layout", "gap"],
  "justify-content": ["layout", "justifyContent"],
  "align-items": ["layout", "alignItems"],
  "align-content": ["layout", "alignContent"],

  color: ["color", "text"],
  "background-color": ["color", "background"],

  "font-family": ["typography", "fontFamily"],
  "font-size": ["typography", "fontSize"],
  "font-style": ["typography", "fontStyle"],
  "font-weight": ["typography", "fontWeight"],
  "line-height": ["typography", "lineHeight"],
  "letter-spacing": ["typography", "letterSpacing"],
  "text-decoration": ["typography", "textDecoration"],
  "text-transform": ["typography", "textTransform"],

  ...boxPaths("padding"),
  ...boxPaths("margin"),

  "background-image": ["background", "image"],
  "background-repeat": ["background", "repeat"],
  "background-position": ["background", "position"],
  "background-attachment": ["background", "attachment"],
  "background-size": ["background", "size"],

  "border-color": ["border", "color"],
  "border-radius": ["border", "radius"],
  "border-style": ["border", "style"],
  "border-width": ["border", "width"],

  "box-shadow": ["shadow"],

  opacity: ["effects", "opacity"],
  cursor: ["effects", "cursor"],
  "text-shadow": ["effects", "textShadow"],
  filter: ["effects", "filter"],
  "backdrop-filter": ["effects", "backdropFilter"],
  transition: ["effects", "transition"],
  transform: ["effects", "transform"],
}
