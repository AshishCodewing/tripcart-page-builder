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
  return (
    <Select value={value} onValueChange={(v) => trait.setValue(v)}>
      <SelectTrigger className="h-8 w-full text-xs" size="sm">
        <SelectValue />
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
