"use client"

import * as React from "react"
import type { PropertyNumber } from "grapesjs"

import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"

export type NumberInputProps = {
  /** Value string. Can be a number ("10"), or a CSS keyword ("auto"). Empty = unset. */
  value: string
  /** Current unit. Empty string = no unit. */
  unit: string
  /** Unit dropdown options. Empty = hide the dropdown. */
  units?: string[]
  min?: number
  max?: number
  step?: number
  slider?: boolean
  placeholder?: string
  ariaLabel?: string
  /**
   * Fires with a fully-composed CSS value (eg "10px", "auto"). Caller can
   * pass it straight to `PropertyNumber.upValue`, which handles parsing.
   */
  onCommit: (value: string, opts?: { partial?: boolean }) => void
  onUnitChange?: (unit: string) => void
}

// Length units the field supports. Anything outside this set typed in the
// input (eg "10s", "10svh") is treated as an invalid unit and dropped.
export const LENGTH_UNITS = [
  "px",
  "em",
  "rem",
  "%",
  "ch",
  "vw",
  "vh",
  "dvh",
  "cqi",
  "cqb",
] as const

// Parse a CSS length-like value into [number, unit]. Examples:
//   "10"     -> ["10", ""]
//   "10px"   -> ["10", "px"]
//   "-1.5em" -> ["-1.5", "em"]
// Returns null for keywords like "auto" / "inherit".
function parseCssValue(raw: string): [string, string] | null {
  const m = raw.trim().match(/^(-?\d*\.?\d+)\s*([a-zA-Z%]*)$/)
  return m ? [m[1], m[2]] : null
}

/**
 * Presentational number/slider input with optional unit dropdown. Accepts
 * strings (eg "auto", "10rem", "10svh") in non-slider mode. No `Property`
 * knowledge — emits composed CSS values so callers can decide where to write.
 */
export function NumberInput({
  value,
  unit,
  units = [],
  min,
  max,
  step = 1,
  slider,
  placeholder,
  ariaLabel,
  onCommit,
  onUnitChange,
}: NumberInputProps) {
  const showSlider =
    slider && typeof min === "number" && typeof max === "number"

  // Local draft so the user can type partial states ("10p", "10pe"...) without
  // firing a commit on every keystroke. We commit on blur/Enter.
  const [draft, setDraft] = React.useState(value)
  React.useEffect(() => setDraft(value), [value])

  if (showSlider) {
    const minN = min as number
    const maxN = max as number
    const numeric = Number(value)
    const safe = Number.isFinite(numeric) ? numeric : minN
    const compose = (n: number | string) =>
      unit ? `${n}${unit}` : `${n}`
    return (
      <div className="flex w-full items-center gap-2">
        <Slider
          min={minN}
          max={maxN}
          step={step}
          value={[safe]}
          onValueChange={(v) => {
            const next = Array.isArray(v) ? v[0] : v
            onCommit(compose(next), { partial: true })
          }}
          onValueCommitted={(v) => {
            const next = Array.isArray(v) ? v[0] : v
            onCommit(compose(next))
          }}
          className="min-w-0 flex-1"
          aria-label={ariaLabel}
        />
        <Input
          type="number"
          min={minN}
          max={maxN}
          step={step}
          value={value}
          onChange={(e) => onCommit(compose(e.target.value))}
          className="w-14 text-end tabular-nums"
          aria-label={ariaLabel}
        />
      </div>
    )
  }

  const commit = () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      if (value !== "") onCommit("")
      if (unit) onUnitChange?.("")
      setDraft("")
      return
    }
    const parsed = parseCssValue(trimmed)
    if (parsed) {
      const [num, parsedUnit] = parsed
      // Only honor a typed unit if it's one we explicitly support — otherwise
      // (eg "10s", "10svh") drop the unit and keep whatever's currently set.
      const acceptedUnit =
        parsedUnit && units.includes(parsedUnit) ? parsedUnit : ""
      if (acceptedUnit) {
        onCommit(`${num}${acceptedUnit}`)
        if (acceptedUnit !== unit) onUnitChange?.(acceptedUnit)
      } else {
        onCommit(unit ? `${num}${unit}` : num)
      }
    } else {
      // Keyword like "auto" / "inherit" — clear the unit since it doesn't apply.
      onCommit(trimmed)
      if (unit) onUnitChange?.("")
    }
  }

  const showUnitSelect = units.length > 0

  return (
    <InputGroup className="h-8">
      <InputGroupInput
        type="text"
        inputSize="sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            ;(e.target as HTMLInputElement).blur()
          } else if (e.key === "Escape") {
            setDraft(value)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        placeholder={placeholder ?? ""}
        className="text-xs tabular-nums"
        aria-label={ariaLabel}
      />
      {showUnitSelect ? (
        <InputGroupAddon align="inline-end">
          <Select
            value={unit}
            onValueChange={(next) => {
              if (next != null) onUnitChange?.(next)
            }}
          >
            <SelectTrigger
              size="sm"
              className="gap-0 rounded-l-none rounded-r-md px-1 py-1 border-0 bg-transparent! text-xs shadow-none [&>svg]:hidden"
            >
              <SelectValue placeholder="-" />
            </SelectTrigger>
            <SelectContent align="end" className="p-1 min-w-14">
              {units.map((u) => (
                <SelectItem key={u} value={u} className="text-xs">
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}

export default function NumberField({
  property,
  slider,
}: {
  property: PropertyNumber
  slider: boolean
}) {
  const rawValue = property.getValue({ noDefault: true })
  const value = rawValue == null ? "" : String(rawValue)
  const unit = property.getUnit() ?? ""
  // If the property defines any units it's a length-typed property — give it
  // the full supported set rather than GrapesJS's narrower defaults. Empty
  // means the property doesn't take units at all (eg `font-weight`), so leave
  // it empty.
  const propUnits = property.getUnits() ?? []
  const units = propUnits.length > 0 ? [...LENGTH_UNITS] : []

  return (
    <NumberInput
      value={value}
      unit={unit}
      units={units}
      min={property.getMin()}
      max={property.getMax()}
      step={property.getStep() || 1}
      slider={slider}
      placeholder={property.getDefaultValue() || "auto"}
      onCommit={(next, opts) => property.upValue(next, opts)}
      onUnitChange={(next) => property.upUnit(next)}
    />
  )
}
