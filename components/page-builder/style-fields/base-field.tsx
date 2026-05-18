"use client"

import type { Property } from "grapesjs"

import { Input } from "@/components/ui/input"

export default function BaseField({ property }: { property: Property }) {
  const defValue = property.getDefaultValue();
  const hasValue = property.hasValue();
  const value = property.getValue();
  const valueString = hasValue ? String(value) : '';
  return (
    <Input
      inputSize="sm"
      type="text"
      value={valueString}
      onChange={(e) => property.upValue(e.target.value)}
      placeholder={defValue}
      className="w-full text-xs"
      spellCheck={false}
      autoComplete="off"
    />
  )
}
