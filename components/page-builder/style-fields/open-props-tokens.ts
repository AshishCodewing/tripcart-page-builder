import sizeTokens from "open-props/src/sizes"
import fontTokens from "open-props/src/fonts"
import borderTokens from "open-props/src/borders"
import colorTokens from "open-props/src/colors"

export type TokenCategory =
  | "size"
  | "font-size"
  | "font-weight"
  | "font-lineheight"
  | "font-letterspacing"
  | "border-size"
  | "border-radius"
  | "color"

export type Token = {
  name: string
  value: string
  category: TokenCategory
}

function fromMap(
  map: Record<string, string>,
  category: TokenCategory,
  keep: (name: string) => boolean
): Token[] {
  return Object.entries(map)
    .filter(([name]) => keep(name))
    .map(([name, value]) => ({ name, value, category }))
}

const SIZE_KEEP = /^--size-(px-)?\d+$|^--size-fluid-\d+$/
const FONT_NUM = /^--font-(size|weight|lineheight|letterspacing)-(\d+|0{1,2})$/

export const TOKENS: Token[] = [
  ...fromMap(sizeTokens, "size", (n) => SIZE_KEEP.test(n)),
  ...fromMap(fontTokens, "font-size", (n) =>
    (FONT_NUM.test(n) && n.includes("-size-")) ||
    /^--font-size-fluid-[0-3]$/.test(n)
  ),
  ...fromMap(fontTokens, "font-weight", (n) => FONT_NUM.test(n) && n.includes("-weight-")),
  ...fromMap(fontTokens, "font-lineheight", (n) => FONT_NUM.test(n) && n.includes("-lineheight-")),
  ...fromMap(fontTokens, "font-letterspacing", (n) => FONT_NUM.test(n) && n.includes("-letterspacing-")),
  ...fromMap(borderTokens, "border-size", (n) => /^--border-size-\d+$/.test(n)),
  ...fromMap(borderTokens, "border-radius", (n) => /^--radius-\d+$/.test(n)),
  ...fromMap(colorTokens, "color", () => true),
]
