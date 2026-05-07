"use client"

import type { PropertySelect } from "grapesjs"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function SelectField({
  property,
}: {
  property: PropertySelect
}) {
  const value = String(property.getValue() ?? "")
  const options = property.getOptions() ?? []

  return (
    <Select
      value={value || undefined}
      onValueChange={(next) => {
        if (next != null) property.upValue(next)
      }}
    >
      <SelectTrigger size="sm" className="w-full text-xs">
        <SelectValue placeholder={property.getDefaultValue() || "—"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => {
          const id = property.getOptionId(opt)
          return (
            <SelectItem key={id} value={id}>
              {property.getOptionLabel(opt)}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
