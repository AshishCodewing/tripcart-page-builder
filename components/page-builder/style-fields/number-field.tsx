"use client"

import * as React from "react"
import type { PropertyNumber } from "grapesjs"

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
import { useNumberDraft } from "./number-field-hooks"
import {
  displayUnit,
  numericPart,
  parseValueShape,
  resolveNumberCommit,
  varCategoriesFor,
} from "./number-field-utils"

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

  const { draft, setDraft, formatDraft } = useNumberDraft(value, units)

  if (showSlider) {
    const minN = min as number
    const maxN = max as number
    // `value` arrives composed ("279deg", "50%", "0.5"). Strip the unit so
    // the slider and the type="number" input get a bare numeric.
    const numericStr = numericPart(value)
    const numeric = Number(numericStr)
    const safe = Number.isFinite(numeric) ? numeric : minN
    const showUnitSelectSlider = units.length > 1
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
        <InputGroup className="h-8 w-20">
          <InputGroupInput
            type="number"
            inputSize="sm"
            min={minN}
            max={maxN}
            step={step}
            value={numericStr}
            onChange={(e) => onCommit(e.target.value)}
            className="no-spinner text-end text-xs tabular-nums"
            aria-label={ariaLabel}
          />
          {showUnitSelectSlider && (
            <InputGroupAddon align="inline-end" className="me-[-0.3rem] gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <InputGroupButton
                      size="xs"
                      variant="ghost"
                      className="h-6 min-w-0 px-1 text-xs text-muted-foreground tabular-nums hover:text-foreground"
                      aria-label="Unit"
                    >
                      {displayUnit(currentUnit)}
                    </InputGroupButton>
                  }
                />
                <DropdownMenuContent>
                  <DropdownMenuRadioGroup
                    value={currentUnit}
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
            </InputGroupAddon>
          )}
        </InputGroup>
      </div>
    )
  }

  const shape = parseValueShape(draft)

  const commit = () => {
    const r = resolveNumberCommit(draft, units, currentUnit)
    if (r.action === "clear") {
      // Only fire when there was something to clear; always reset the input.
      if (value !== "") onCommit("")
      setDraft("")
      return
    }
    // Re-display the composed value for numeric paths (a stale unit list still
    // lets explicit units through — PropertyNumber drops invalid ones).
    if (r.reformat) setDraft(formatDraft(r.value))
    onCommit(r.value)
  }

  // Dropdown visible when the property advertises a unit list; disabled when
  // the current draft isn't a parseable number (fixed-value or expression).
  const showUnitSelect = units.length > 1
  const unitDisabled = shape.kind !== "numeric"
  const triggerUnit = shape.kind === "numeric" ? shape.unit || currentUnit : ""

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
        <InputGroupAddon align="inline-end" className="me-[-0.3rem] gap-1">
          {showUnitSelect &&
            (unitDisabled ? (
              // Inert chip for fixed-values (var(), auto, …). We avoid a
              // `disabled` button here because InputGroup's `has-disabled`
              // selector would dim the whole field (input-group.tsx:15).
              <span
                className="flex h-6 items-center px-1 text-xs text-muted-foreground/60 tabular-nums select-none"
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
