"use client"

import type { Trait } from "grapesjs"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function SelectTraitField({ trait }: { trait: Trait }) {
  const value = String(trait.getValue() ?? "")
  const options = trait.getOptions()
  return (
    <Select value={value} onValueChange={(v) => trait.setValue(v)}>
      <SelectTrigger className="h-8 w-full text-xs" size="sm">
        {/* base-ui's Select.Value renders the raw value by default — pass a
            children fn so the trigger shows the option label (e.g. "Manual")
            instead of the raw id ("manual"). */}
        <SelectValue>
          {(val) => {
            if (val == null || val === "") return null
            const opt = options.find(
              (o) => String(trait.getOptionId(o)) === String(val)
            )
            return opt ? trait.getOptionLabel(opt) : String(val)
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {trait.getOptions().map((opt) => {
          const id = String(trait.getOptionId(opt))
          return (
            <SelectItem key={id} value={id} className="text-xs">
              {trait.getOptionLabel(opt)}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
