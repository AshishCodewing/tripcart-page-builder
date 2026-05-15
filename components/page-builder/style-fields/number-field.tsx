"use client"

import * as React from "react"
import type { Property, PropertyNumber } from "grapesjs"

import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Slider } from "@/components/ui/slider"

import { CssVarPicker } from "./css-var-picker"
import type { TokenCategory } from "./open-props-tokens"

const BORDER_RADIUS_RE = /border.*radius/
// Number with optional unit suffix: 16, -4, 0.5, .5, 16px, 100%, -1.5rem.
// Anything else (var(...), calc(...), auto, etc.) falls through to "fixed".
const VALUE_SHAPE_RE = /^(-?(?:\d+\.?\d*|\.\d+))([a-zA-Z%]*)$/

type ValueShape =
  | { kind: "empty" }
  | { kind: "numeric"; number: string; unit: string }
  | { kind: "fixed"; value: string }

function parseValueShape(raw: string): ValueShape {
  const trimmed = raw.trim()
  if (!trimmed) return { kind: "empty" }
  const m = trimmed.match(VALUE_SHAPE_RE)
  if (m) return { kind: "numeric", number: m[1], unit: m[2] }
  return { kind: "fixed", value: trimmed }
}

// Empty-string unit (line-height accepts unitless `1.5`) displays as "—" so
// the trigger never renders an invisible label.
const displayUnit = (u: string): string => (u === "" ? "—" : u)

export type NumberInputProps = {
  /** CSS value string — composed form, e.g. "16px" or "var(--x)". Empty = unset. */
  value: string
  /** Available units from the property's `units` config. Empty = no dropdown. */
  units?: string[]
  /** Active unit on the property (from `property.getUnit()`). */
  currentUnit?: string
  /** Called when the unit dropdown changes. Caller wires to `property.upUnit`. */
  onUnitChange?: (unit: string) => void
  min?: number
  max?: number
  step?: number
  slider?: boolean
  placeholder?: string
  ariaLabel?: string
  /** When set, shows a CssVarPicker addon filtered to these token categories. */
  varCategories?: TokenCategory[]
  /** Fires with the raw CSS value. Caller passes it straight to `property.upValue`. */
  onCommit: (value: string, opts?: { partial?: boolean }) => void
}

/**
 * Presentational text/slider input. The text field accepts any CSS string —
 * bare numbers compose with the active unit, var()/calc()/identifiers pass
 * through verbatim (via `fixedValues` on PropertyNumber). A unit selector
 * sits beside the input when the property advertises >1 unit and dims to "—"
 * for non-numeric values.
 */
export function NumberInput({
  value,
  units = [],
  currentUnit = "",
  onUnitChange,
  min,
  max,
  step = 1,
  slider,
  placeholder,
  ariaLabel,
  varCategories,
  onCommit,
}: NumberInputProps) {
  const showSlider =
    slider && typeof min === "number" && typeof max === "number"

  // Adjusting state during render (React's documented pattern for resetting
  // local state when a prop changes) so the dropdown's unit swap and the
  // variable-picker insertion both reach the input without a blur dance.
  const [draft, setDraft] = React.useState(value)
  const [lastValue, setLastValue] = React.useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(value)
  }

  if (showSlider) {
    const minN = min as number
    const maxN = max as number
    const numeric = Number(value)
    const safe = Number.isFinite(numeric) ? numeric : minN
    return (
      <div className="flex w-full items-center gap-2">
        <Slider
          min={minN}
          max={maxN}
          step={step}
          value={[safe]}
          onValueChange={(v) => {
            const next = Array.isArray(v) ? v[0] : v
            onCommit(String(next), { partial: true })
          }}
          onValueCommitted={(v) => {
            const next = Array.isArray(v) ? v[0] : v
            onCommit(String(next))
          }}
          className="min-w-0 flex-1 **:data-[slot=slider-thumb]:size-3.5! **:data-[slot=slider-thumb]:border! **:data-[slot=slider-track]:h-1!"
          aria-label={ariaLabel}
        />
        <Input
          type="number"
          inputSize="sm"
          min={minN}
          max={maxN}
          step={step}
          value={value}
          onChange={(e) => onCommit(e.target.value)}
          className="no-spinner w-14 text-end tabular-nums text-xs"
          aria-label={ariaLabel}
        />
      </div>
    )
  }

  const shape = parseValueShape(draft)

  const commit = () => {
    const next = parseValueShape(draft)
    if (next.kind === "empty") {
      if (value !== "") onCommit("")
      setDraft("")
      return
    }
    // Fixed-values (var, calc, auto, …) pass through verbatim.
    // PropertyNumber.validateInputValue matches against `fixedValues` and
    // stores the matched portion with unit cleared.
    if (next.kind === "fixed") {
      onCommit(next.value)
      return
    }
    // numeric with explicit unit — pass through. If the unit isn't in the
    // configured `units` list, PropertyNumber will drop it; we still let it
    // through so authors aren't blocked by a stale unit list.
    if (next.unit) {
      onCommit(`${next.number}${next.unit}`)
      return
    }
    // numeric, no unit — compose with current/default. For line-height the
    // default is "" (unitless) so we commit just the bare number.
    if (units.length) {
      const useUnit = currentUnit || units[0] || ""
      const composed = useUnit ? `${next.number}${useUnit}` : next.number
      setDraft(composed)
      onCommit(composed)
      return
    }
    onCommit(next.number)
  }

  // Dropdown visible when the property advertises a unit list; disabled when
  // the current draft isn't a parseable number (fixed-value or expression).
  const showUnitSelect = units.length > 1
  const unitDisabled = shape.kind !== "numeric"
  const triggerUnit =
    shape.kind === "numeric" ? shape.unit || currentUnit : ""

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
      {(showUnitSelect || varCategories) && (
        <InputGroupAddon align="inline-end" className="gap-1">
          {showUnitSelect &&
            (unitDisabled ? (
              // Inert chip for fixed-values (var(), auto, …). We avoid a
              // `disabled` button here because InputGroup's `has-disabled`
              // selector would dim the whole field (input-group.tsx:15).
              <span
                className="flex h-6 select-none items-center px-1 text-xs tabular-nums text-muted-foreground/60"
                aria-label="Unit (not applicable)"
              >
                —
              </span>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <InputGroupButton
                      size="xs"
                      variant="ghost"
                      className="h-6 min-w-0 px-1 text-xs text-muted-foreground tabular-nums hover:text-foreground"
                      aria-label="Unit"
                    >
                      {displayUnit(triggerUnit)}
                    </InputGroupButton>
                  }
                />
                <DropdownMenuContent>
                  <DropdownMenuRadioGroup
                    value={triggerUnit}
                    onValueChange={(next) => {
                      if (next != null && onUnitChange) onUnitChange(next)
                    }}
                  >
                    {units.map((u) => (
                      <DropdownMenuRadioItem
                        key={u || "_unitless"}
                        value={u}
                        className="text-xs"
                      >
                        {displayUnit(u)}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          {varCategories && (
            <CssVarPicker
              categories={varCategories}
              onSelect={(expr) => {
                onCommit(expr)
                setDraft(expr)
              }}
            />
          )}
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}

// A property is "length-like" when it advertises a unit list. z-index /
// flex-grow / filter-value have no units and so don't get the variable picker.
function varCategoriesFor(property: Property): TokenCategory[] | undefined {
  const units = (property as PropertyNumber).getUnits?.() ?? []
  if (!units.length) return undefined
  const name = property.getName()
  if (BORDER_RADIUS_RE.test(name)) return ["border-radius"]
  if (name === "font-size") return ["font-size"]
  if (name === "line-height") return ["font-lineheight"]
  if (name === "letter-spacing") return ["font-letterspacing"]
  return ["size"]
}

export default function NumberField({
  property,
  slider,
}: {
  property: PropertyNumber
  slider: boolean
}) {
  const defValue = property.getDefaultValue()
  const hasValue = property.hasValue()
  // getFullValue() composes value+unit; falls back to value alone when
  // unit is empty (e.g. fixed-values like `var(--x)` or unitless line-height).
  const composed = hasValue ? property.getFullValue() : ""
  const units = property.getUnits?.() ?? []
  const currentUnit = property.getUnit?.() ?? ""

  return (
    <NumberInput
      key={property.getId()}
      value={composed}
      units={units}
      currentUnit={currentUnit}
      onUnitChange={(unit) => property.upUnit(unit)}
      step={property.getStep?.() ?? 1}
      min={property.getMin?.()}
      max={property.getMax?.()}
      slider={slider}
      placeholder={defValue}
      varCategories={varCategoriesFor(property)}
      onCommit={(next, opts) => property.upValue(next, opts)}
    />
  )
}
