"use client"

import * as React from "react"
import type { Property } from "grapesjs"

import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Slider } from "@/components/ui/slider"

import { CssVarPicker } from "./css-var-picker"
import type { TokenCategory } from "./open-props-tokens"

export type NumberInputProps = {
  /** CSS value string — plain number ("10"), length ("16px"), or any CSS expression ("var(--spacing)"). Empty = unset. */
  value: string
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
 * Presentational text/slider input. Accepts any CSS string verbatim —
 * no unit dropdown, no parsing. CSS variables and functions work as-is.
 */
export function NumberInput({
  value,
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

  const [draft, setDraft] = React.useState(value)
  React.useEffect(() => setDraft(value), [value])

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

  const commit = () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      if (value !== "") onCommit("")
      setDraft("")
      return
    }
    onCommit(trimmed)
  }

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
      {varCategories && (
        <InputGroupAddon align="inline-end">
          <CssVarPicker
            categories={varCategories}
            onSelect={(expr) => {
              onCommit(expr)
              setDraft(expr)
            }}
          />
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}

function varCategoriesFor(property: Property): TokenCategory[] | undefined {
  if (property.getType() !== "length") return undefined
  const name = property.getName()
  if (/border.*radius/.test(name)) return ["border-radius"]
  if (name === "font-size")        return ["font-size"]
  if (name === "line-height")      return ["font-lineheight"]
  if (name === "letter-spacing")   return ["font-letterspacing"]
  return ["size"]
}

export default function NumberField({
  property,
  slider,
}: {
  property: Property
  slider: boolean
}) {
  const rawValue = property.getValue({ noDefault: true })
  const value = rawValue == null ? "" : String(rawValue)

  return (
    <NumberInput
      value={value}
      step={1}
      slider={slider}
      placeholder={property.getDefaultValue() || "auto"}
      varCategories={varCategoriesFor(property)}
      onCommit={(next, opts) => property.upValue(next, opts)}
    />
  )
}
