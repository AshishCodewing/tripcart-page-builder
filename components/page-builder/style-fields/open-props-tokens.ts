import sizeTokens from "open-props/src/sizes"
import fontTokens from "open-props/src/fonts"
import borderTokens from "open-props/src/borders"
import colorTokens from "open-props/src/props.colors-hsl.js"

export type TokenCategory =
  | "size"
  | "font-size"
  | "font-weight"
  | "font-lineheight"
  | "font-letterspacing"
  | "border-size"
  | "border-radius"
  | "color"
  | "theme-color"

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

const THEME_COLOR_TOKENS: Token[] = [
  {
    name: "background",
    value: "--tc--preset--color--background",
    category: "theme-color",
  },
  {
    name: "foreground",
    value: "--tc--preset--color--foreground",
    category: "theme-color",
  },
  { name: "card", value: "--tc--preset--color--card", category: "theme-color" },
  {
    name: "card-foreground",
    value: "--tc--preset--color--card-foreground",
    category: "theme-color",
  },
  {
    name: "popover",
    value: "--tc--preset--color--popover",
    category: "theme-color",
  },
  {
    name: "popover-foreground",
    value: "--tc--preset--color--popover-foreground",
    category: "theme-color",
  },
  {
    name: "primary",
    value: "--tc--preset--color--primary",
    category: "theme-color",
  },
  {
    name: "primary-foreground",
    value: "--tc--preset--color--primary-foreground",
    category: "theme-color",
  },
  {
    name: "secondary",
    value: "--tc--preset--color--secondary",
    category: "theme-color",
  },
  {
    name: "secondary-foreground",
    value: "--tc--preset--color--secondary-foreground",
    category: "theme-color",
  },
  {
    name: "muted",
    value: "--tc--preset--color--muted",
    category: "theme-color",
  },
  {
    name: "muted-foreground",
    value: "--tc--preset--color--muted-foreground",
    category: "theme-color",
  },
  {
    name: "accent",
    value: "--tc--preset--color--accent",
    category: "theme-color",
  },
  {
    name: "accent-foreground",
    value: "--tc--preset--color--accent-foreground",
    category: "theme-color",
  },
  {
    name: "destructive",
    value: "--tc--preset--color--destructive",
    category: "theme-color",
  },
  {
    name: "warning",
    value: "--tc--preset--color--warning",
    category: "theme-color",
  },
  {
    name: "warning-foreground",
    value: "--tc--preset--color--warning-foreground",
    category: "theme-color",
  },
  {
    name: "success",
    value: "--tc--preset--color--success",
    category: "theme-color",
  },
  {
    name: "success-foreground",
    value: "--tc--preset--color--success-foreground",
    category: "theme-color",
  },
  {
    name: "border",
    value: "--tc--preset--color--border",
    category: "theme-color",
  },
  {
    name: "input",
    value: "--tc--preset--color--input",
    category: "theme-color",
  },
  { name: "ring", value: "--tc--preset--color--ring", category: "theme-color" },
]

export const TOKENS: Token[] = [
  ...fromMap(sizeTokens, "size", (n) => SIZE_KEEP.test(n)),
  ...fromMap(
    fontTokens,
    "font-size",
    (n) =>
      (FONT_NUM.test(n) && n.includes("-size-")) ||
      /^--font-size-fluid-[0-3]$/.test(n)
  ),
  ...fromMap(
    fontTokens,
    "font-weight",
    (n) => FONT_NUM.test(n) && n.includes("-weight-")
  ),
  ...fromMap(
    fontTokens,
    "font-lineheight",
    (n) => FONT_NUM.test(n) && n.includes("-lineheight-")
  ),
  ...fromMap(
    fontTokens,
    "font-letterspacing",
    (n) => FONT_NUM.test(n) && n.includes("-letterspacing-")
  ),
  ...fromMap(borderTokens, "border-size", (n) => /^--border-size-\d+$/.test(n)),
  ...fromMap(borderTokens, "border-radius", (n) => /^--radius-\d+$/.test(n)),
  ...THEME_COLOR_TOKENS,
  ...fromMap(colorTokens, "color", () => true),
]
