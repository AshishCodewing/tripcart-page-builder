"use client"

import type { Trait } from "grapesjs"

import { Switch } from "@/components/ui/switch"

export default function CheckboxTraitField({ trait }: { trait: Trait }) {
  const checked = Boolean(trait.getValue({ useType: true }))
  return (
    <Switch
      size="sm"
      checked={checked}
      onCheckedChange={(next) => trait.setValue(next)}
    />
  )
}
