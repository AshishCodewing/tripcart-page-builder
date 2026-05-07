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
  const min = property.getMin()
  const max = property.getMax()
  const step = property.getStep() || 1

  const commit = (next: string, opts: { partial?: boolean } = {}) => {
    const trimmed = next.trim()
    const composed = trimmed && unit ? `${trimmed}${unit}` : trimmed
    property.upValue(composed, opts)
  }

  if (slider && Number.isFinite(min) && Number.isFinite(max)) {
    const numeric = Number(value)
    const safe = Number.isFinite(numeric) ? numeric : min
    return (
      <div className="flex w-full items-center gap-2">
        <Slider
          min={min}
          max={max}
          step={step}
          value={[safe]}
          onValueChange={(v) => {
            const next = Array.isArray(v) ? v[0] : v
            commit(String(next), { partial: true })
          }}
          onValueCommitted={(v) => {
            const next = Array.isArray(v) ? v[0] : v
            commit(String(next))
          }}
          className="min-w-0 flex-1"
        />
        <Input
          inputSize="sm"
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => commit(e.target.value)}
          className="w-14 text-end tabular-nums"
        />
      </div>
    )
  }

  return (
    <InputGroup className="h-6">
      <InputGroupInput
        inputSize="sm"
        type="number"
        step={step}
        value={value}
        onChange={(e) => commit(e.target.value)}
        placeholder={property.getDefaultValue() || ""}
        className="text-xs tabular-nums"
      />
      {units.length > 0 ? (
        <InputGroupAddon align="inline-end" className="py-0 pe-0">
          <Select
            value={unit || units[0]}
            onValueChange={(next) => {
              if (next != null) property.upUnit(next)
            }}
          >
            <SelectTrigger
              size="sm"
              className="h-6 gap-0 rounded-l-none rounded-r-md border-0 bg-transparent px-2 text-xs shadow-none focus-visible:ring-0 [&>svg]:hidden"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
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
