"use client"

import type { PropertySelect } from "grapesjs"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { humanizeLabel } from "@/lib/utils"

export default function SelectField({
  property,
}: {
  property: PropertySelect
}) {
  const value = String(property.getValue() ?? "")
  const options = property.getOptions() ?? []

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next != null) property.upValue(next)
      }}
    >
      <SelectTrigger size="sm" className="w-full text-xs">
        {/* base-ui's Select.Value renders the raw value by default — pass a
            children fn so the trigger shows the humanized option label
            (or the value itself, humanized, if no custom label was set). */}
        <SelectValue
          placeholder={humanizeLabel(property.getDefaultValue() || "—")}
        >
          {(val) => {
            if (val == null || val === "") return null
            const opt = options.find((o) => property.getOptionId(o) === val)
            return humanizeLabel(
              opt ? property.getOptionLabel(opt) : String(val)
            )
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="p-1">
        {options.map((opt) => {
          const id = property.getOptionId(opt)
          return (
            <SelectItem key={id} value={id} className="text-xs">
              {humanizeLabel(property.getOptionLabel(opt))}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
