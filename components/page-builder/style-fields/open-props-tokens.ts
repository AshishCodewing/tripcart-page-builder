import sizeTokens from "open-props/src/sizes"
import fontTokens from "open-props/src/fonts"
import borderTokens from "open-props/src/borders"
import colorTokens from "open-props/src/colors"

export type TokenCategory = "size" | "font" | "border" | "color"

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
const FONT_KEEP =
  /^--font-(size|weight|lineheight|letterspacing)-\d+$|^--font-(size|weight|lineheight|letterspacing)-0{1,2}$/
const BORDER_KEEP = /^--(border-size|radius)-\d+$/

export const TOKENS: Token[] = [
  ...fromMap(sizeTokens, "size", (n) => SIZE_KEEP.test(n)),
  ...fromMap(fontTokens, "font", (n) => FONT_KEEP.test(n)),
  ...fromMap(borderTokens, "border", (n) => BORDER_KEEP.test(n)),
  ...fromMap(colorTokens, "color", () => true),
]
