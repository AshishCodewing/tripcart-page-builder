"use client"

import type { PropertySelect, SelectOption } from "grapesjs"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { OPTION_ICONS } from "./option-icons"
import SelectField from "./select-field"

const SENTINEL = "__radio_unset__"

export default function RadioField({
  property,
}: {
  property: PropertySelect
}) {
  const value = String(property.getValue() ?? "")
  const options = property.getOptions() ?? []
  const propIcons = OPTION_ICONS[property.getName()]
  const allHaveIcons =
    !!propIcons &&
    options.length > 0 &&
    options.every((opt) => propIcons[property.getOptionId(opt)])

  // No clean icon set for this property (eg. position) — fall back to the
  // Select dropdown so the field reads the same way as Display.
  if (!allHaveIcons) {
    return <SelectField property={property} />
  }

  return (
    <ToggleGroup
      value={[value || SENTINEL]}
      onValueChange={(values: string[]) => {
        const next = values[0]
        if (!next || next === SENTINEL) return
        property.upValue(next)
      }}
      aria-label={property.getLabel()}
      className="w-full"
    >
      {options.map((opt: SelectOption) => {
        const id = property.getOptionId(opt)
        const label = property.getOptionLabel(opt)
        const Icon = propIcons![id]

        return (
          <ToggleGroupItem
            key={id}
            value={id}
            aria-label={label}
            title={label}
            className="min-w-0 flex-1 px-2 py-1 text-xs"
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
