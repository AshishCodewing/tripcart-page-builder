import {
  AlignCenter,
  AlignHorizontalDistributeCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceAround,
  AlignHorizontalSpaceBetween,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Ban,
  Baseline,
  CaseLower,
  CaseSensitive,
  CaseUpper,
  Italic,
  Strikethrough,
  StretchVertical,
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
  // Flex container axis. Icons are direction-agnostic (the same arrow set
  // reads the same regardless of writing mode) so they work for both row
  // and column flow once the user understands the convention.
  "flex-direction": {
    row: ArrowRight,
    "row-reverse": ArrowLeft,
    column: ArrowDown,
    "column-reverse": ArrowUp,
  },
  // Main-axis distribution. Horizontal-axis lucide icons for visual clarity;
  // they still read correctly when the parent is column-flow because the
  // semantics (start / center / end / between / around / evenly) are the same.
  "justify-content": {
    "flex-start": AlignHorizontalJustifyStart,
    center: AlignHorizontalJustifyCenter,
    "flex-end": AlignHorizontalJustifyEnd,
    "space-between": AlignHorizontalSpaceBetween,
    "space-around": AlignHorizontalSpaceAround,
    "space-evenly": AlignHorizontalDistributeCenter,
  },
  // Cross-axis alignment. Vertical-axis icons mirror the main-axis set so
  // the picker pair (Justify + Align) reads as orthogonal at a glance.
  "align-items": {
    "flex-start": AlignVerticalJustifyStart,
    center: AlignVerticalJustifyCenter,
    "flex-end": AlignVerticalJustifyEnd,
    baseline: Baseline,
    stretch: StretchVertical,
  },
  // Per-child override of align-items. Adds `auto` (= inherit from parent).
  "align-self": {
    auto: Ban,
    "flex-start": AlignVerticalJustifyStart,
    center: AlignVerticalJustifyCenter,
    "flex-end": AlignVerticalJustifyEnd,
    baseline: Baseline,
    stretch: StretchVertical,
  },
}
