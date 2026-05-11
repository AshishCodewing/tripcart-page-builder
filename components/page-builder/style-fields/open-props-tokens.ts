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
  { name: "--theme-background",          value: "page background",    category: "theme-color" },
  { name: "--theme-foreground",          value: "page text",          category: "theme-color" },
  { name: "--theme-card",                value: "card background",    category: "theme-color" },
  { name: "--theme-card-foreground",     value: "card text",          category: "theme-color" },
  { name: "--theme-popover",             value: "popover background", category: "theme-color" },
  { name: "--theme-popover-foreground",  value: "popover text",       category: "theme-color" },
  { name: "--theme-primary",             value: "primary action",     category: "theme-color" },
  { name: "--theme-primary-foreground",  value: "primary text",       category: "theme-color" },
  { name: "--theme-secondary",           value: "secondary action",   category: "theme-color" },
  { name: "--theme-secondary-foreground",value: "secondary text",     category: "theme-color" },
  { name: "--theme-muted",               value: "muted background",   category: "theme-color" },
  { name: "--theme-muted-foreground",    value: "muted text",         category: "theme-color" },
  { name: "--theme-accent",              value: "accent background",  category: "theme-color" },
  { name: "--theme-accent-foreground",   value: "accent text",        category: "theme-color" },
  { name: "--theme-destructive",         value: "destructive action", category: "theme-color" },
  { name: "--theme-warning",             value: "warning state",      category: "theme-color" },
  { name: "--theme-warning-foreground",  value: "warning text",       category: "theme-color" },
  { name: "--theme-success",             value: "success state",      category: "theme-color" },
  { name: "--theme-success-foreground",  value: "success text",       category: "theme-color" },
  { name: "--theme-border",              value: "border color",       category: "theme-color" },
  { name: "--theme-input",               value: "input border",       category: "theme-color" },
  { name: "--theme-ring",                value: "focus ring",         category: "theme-color" },
]

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
  ...THEME_COLOR_TOKENS,
  ...fromMap(colorTokens, "color", () => true),
]
