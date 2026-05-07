import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Ban,
  CaseLower,
  CaseSensitive,
  CaseUpper,
  Italic,
  Strikethrough,
  Underline,
  type LucideIcon,
} from "lucide-react"

// Map of CSS property → option value → icon. RadioField swaps labels for
// icons only when ALL options of a given property have a mapping (otherwise
// you get a row of mixed icons + text, which reads worse than plain labels).
export const OPTION_ICONS: Record<string, Record<string, LucideIcon>> = {
  "text-align": {
    left: AlignLeft,
    center: AlignCenter,
    right: AlignRight,
    justify: AlignJustify,
  },
  float: {
    none: Ban,
    left: AlignLeft,
    right: AlignRight,
  },
  "font-style": {
    normal: Ban,
    italic: Italic,
  },
  "text-decoration": {
    none: Ban,
    underline: Underline,
    "line-through": Strikethrough,
  },
  "text-transform": {
    none: Ban,
    uppercase: CaseUpper,
    lowercase: CaseLower,
    capitalize: CaseSensitive,
  },
}
