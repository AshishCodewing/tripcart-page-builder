"use client"

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
  /** Bare number string (no unit). Empty string = unset. */
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
  /** Fired with the bare value (no unit). Composition is the caller's job. */
  onCommit: (value: string, opts?: { partial?: boolean }) => void
  onUnitChange?: (unit: string) => void
}

/**
 * Presentational number/slider input with optional unit dropdown. No
 * `Property` knowledge — emits raw value/unit changes so callers can decide
 * how to compose them and where to write (one Property, several
 * sub-Properties, etc.).
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
          className="min-w-0 flex-1"
          aria-label={ariaLabel}
        />
        <Input
          type="number"
          min={minN}
          max={maxN}
          step={step}
          value={value}
          onChange={(e) => onCommit(e.target.value)}
          className="w-14 text-end tabular-nums"
          aria-label={ariaLabel}
        />
      </div>
    )
  }

  return (
    <InputGroup className="h-8">
      <InputGroupInput
        type="number"
        step={step}
        inputSize="sm"
        value={value}
        onChange={(e) => onCommit(e.target.value)}
        placeholder={placeholder ?? ""}
        className="text-xs tabular-nums"
        aria-label={ariaLabel}
      />
      {units.length > 0 ? (
        <InputGroupAddon align="inline-end">
          <Select
            value={unit || units[0]}
            onValueChange={(next) => {
              if (next != null) onUnitChange?.(next)
            }}
          >
            <SelectTrigger
              size="sm"
              className="gap-0 rounded-l-none rounded-r-md px-1 py-1 border-0 bg-transparent! text-xs shadow-none [&>svg]:hidden"
            >
              <SelectValue />
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
  const rawValue = property.getValue()
  const value = rawValue == null ? "" : String(rawValue)
  const unit = property.getUnit() ?? ""
  const units = property.getUnits() ?? []

  return (
    <NumberInput
      value={value}
      unit={unit}
      units={units}
      min={property.getMin()}
      max={property.getMax()}
      step={property.getStep() || 1}
      slider={slider}
      placeholder={property.getDefaultValue() || ""}
      onCommit={(next, opts) => {
        const trimmed = next.trim()
        const composed = trimmed && unit ? `${trimmed}${unit}` : trimmed
        property.upValue(composed, opts)
      }}
      onUnitChange={(next) => property.upUnit(next)}
    />
  )
}
