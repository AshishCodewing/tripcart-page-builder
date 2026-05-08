"use client"

import type { Property } from "grapesjs"

import { Input } from "@/components/ui/input"

export default function BaseField({ property }: { property: Property }) {
  const value = String(property.getValue() ?? "")
  return (
    <Input
      inputSize="sm"
      type="text"
      value={value}
      onChange={(e) => property.upValue(e.target.value)}
      placeholder={property.getDefaultValue() || ""}
      className="w-full"
      spellCheck={false}
      autoComplete="off"
    />
  )
}
