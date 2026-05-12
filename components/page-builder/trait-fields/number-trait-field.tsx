"use client"

import type { Trait } from "grapesjs"

import { NumberInput } from "../style-fields/number-field"

export default function NumberTraitField({ trait }: { trait: Trait }) {
  const value = String(trait.getValue() ?? "")
  return (
    <div className="w-full">
      <NumberInput
        value={value}
        placeholder={String(trait.getDefault() ?? "")}
        onCommit={(val, opts) => trait.setValue(val, opts)}
      />
    </div>
  )
}
