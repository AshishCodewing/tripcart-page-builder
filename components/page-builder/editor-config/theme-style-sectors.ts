// Style Manager sectors for the theme admin's Blocks screen.
//
// Every control is the page editor's own: the declarations are lifted straight
// out of `STYLE_SECTORS` by property name, so a colour, a length or an
// alignment toggle behaves and looks identical on both screens, and any later
// improvement to a field is inherited here for free. The sectors mirror the
// editor's too — same names, same order, same membership — minus Size and
// Position, which are per-instance decisions the theme doesn't store.
//
// The theme decides one thing: WHICH properties it can store. `SECTOR_GROUPS`
// says which theme style groups each sector draws from, so a part that narrows
// its `supports` hides exactly the sectors that would write nowhere.
//
// Three overrides, each forced by how the theme stores a value, not by taste:
//   - `margin` / `padding` / `border` are marked `detached`, so GrapesJS writes
//     the longhands (`padding-top`, `border-width`, …) instead of a shorthand.
//     The theme stores those per side / per facet. `border-radius`, `gap`,
//     `box-shadow`, `text-shadow`, `transition`, `transform` and `filter` need
//     no such treatment: they compose to a single declaration, which is exactly
//     what the theme keeps. The background stack is detached by the plugin.
//   - the flex alignment properties drop `requires: { display: [...] }`. That
//     gate reads `display` off the rule being edited, and a part that is flex
//     through its own structural CSS (the tab bar) has no `display` in the
//     theme — its alignment rows would stay hidden until a tenant redundantly
//     set one.

import type { EditorConfig } from "grapesjs"

import type { StyleGroup } from "@/lib/theme/style-surfaces"

import { STYLE_SECTORS } from "./style-sectors"

type StyleSectors = NonNullable<
  NonNullable<EditorConfig["styleManager"]>["sectors"]
>

type PropertyDecl = NonNullable<StyleSectors[number]["properties"]>[number]

const declName = (decl: PropertyDecl): string => {
  if (typeof decl === "string") return decl
  const obj = decl as { property?: string; extend?: string }
  return obj.property ?? obj.extend ?? ""
}

// Every property the page editor declares, by name. `STYLE_SECTORS` already
// includes the layout sector, so this covers the whole editor panel.
const EDITOR_PROPERTIES = new Map<string, PropertyDecl>(
  STYLE_SECTORS.flatMap((sector) =>
    (sector.properties ?? []).map(
      (decl) => [declName(decl), decl] as [string, PropertyDecl]
    )
  )
)

/**
 * The editor's declaration for one property, with optional overrides. A bare
 * string becomes `{ extend }` so overrides can be merged onto it while the
 * built-in definition still resolves.
 */
const editorProperty = (
  name: string,
  overrides: Record<string, unknown> = {}
): PropertyDecl => {
  const decl = EDITOR_PROPERTIES.get(name)
  if (!decl) {
    throw new Error(
      `Theme sectors reference "${name}", which the editor doesn't declare.`
    )
  }
  const base = typeof decl === "string" ? { extend: decl } : { ...decl }
  return { ...base, ...overrides } as PropertyDecl
}

const detached = { detached: true }
// `requires` is inherited from the built-in when extending; clearing it here
// makes the row visible on a rule that doesn't itself declare `display`.
const noDisplayGate = { requires: undefined }

/** Which theme style groups each sector's properties are stored under. */
export const SECTOR_GROUPS: Record<string, readonly StyleGroup[]> = {
  layout: ["layout"],
  spacing: ["spacing"],
  typography: ["typography", "color"],
  background: ["background", "color"],
  border: ["border"],
  effects: ["effects", "shadow"],
}

export const THEME_STYLE_SECTORS: StyleSectors = [
  {
    id: "layout",
    name: "Layout",
    open: false,
    properties: [
      editorProperty("display"),
      editorProperty("flex-direction"),
      editorProperty("flex-wrap"),
      editorProperty("gap"),
      editorProperty("justify-content", noDisplayGate),
      editorProperty("align-items", noDisplayGate),
      editorProperty("align-content", noDisplayGate),
    ],
  },
  {
    id: "spacing",
    name: "Spacing",
    open: false,
    properties: [
      editorProperty("margin", detached),
      editorProperty("padding", detached),
    ],
  },
  {
    id: "typography",
    name: "Typography",
    open: true,
    properties: [
      editorProperty("font-family"),
      editorProperty("color"),
      editorProperty("font-size"),
      editorProperty("font-weight"),
      editorProperty("line-height"),
      editorProperty("letter-spacing"),
      editorProperty("font-style"),
      editorProperty("text-transform"),
      editorProperty("text-decoration"),
    ],
  },
  {
    id: "background",
    name: "Background",
    open: false,
    properties: [
      editorProperty("background"),
      editorProperty("background-color"),
    ],
  },
  {
    id: "border",
    name: "Border",
    open: false,
    properties: [
      editorProperty("border", detached),
      editorProperty("border-radius"),
    ],
  },
  {
    id: "effects",
    name: "Effects",
    open: false,
    properties: [
      editorProperty("opacity"),
      editorProperty("cursor"),
      editorProperty("box-shadow"),
      editorProperty("text-shadow"),
      editorProperty("filter"),
      editorProperty("backdrop-filter"),
      editorProperty("transition"),
      editorProperty("transform"),
    ],
  },
]
