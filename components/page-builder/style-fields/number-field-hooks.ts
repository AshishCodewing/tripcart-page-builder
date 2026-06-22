"use client"

import * as React from "react"

import { parseValueShape } from "./number-field-utils"

type NumberDraft = {
  draft: string
  setDraft: React.Dispatch<React.SetStateAction<string>>
  // Strip the unit for display when a unit chip is shown (avoids "200px px").
  formatDraft: (raw: string) => string
}

// Owns the text input's draft string and keeps it in sync with the composed
// `value` prop (unit-dropdown swaps, variable-picker insertion). Uses React's
// documented "adjust state during render" reset pattern so prop changes reach
// the input without a blur dance.
export function useNumberDraft(value: string, units: string[]): NumberDraft {
  // When the unit chip is visible (multi-unit field), strip the unit from the
  // displayed value — the chip already shows it, so showing it in the input
  // too reads as duplication. Fixed-values ("auto", "var(--x)") pass through.
  const formatDraft = React.useCallback(
    (raw: string) => {
      if (units.length <= 1) return raw
      const s = parseValueShape(raw)
      if (s.kind === "numeric" && s.unit) return s.number
      return raw
    },
    [units.length]
  )

  const [draft, setDraft] = React.useState(() => formatDraft(value))
  const [lastValue, setLastValue] = React.useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(formatDraft(value))
  }

  return { draft, setDraft, formatDraft }
}
