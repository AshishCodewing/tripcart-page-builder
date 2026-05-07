"use client"

import * as React from "react"
import type { PropertyComposite } from "grapesjs"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

// Three canonical `flex` shorthands the Studio SDK exposes as a preset radio.
// The picker writes through to the underlying composite sub-properties so the
// Auto / Fill / Hug rows stay in sync with the grow / shrink / basis fields.
type PresetId = "auto" | "fill" | "hug"

type Preset = {
  id: PresetId
  label: string
  title: string
  values: { "flex-grow": string; "flex-shrink": string; "flex-basis": string }
}

const PRESETS: Preset[] = [
  {
    id: "auto",
    label: "Auto",
    title: "Size from content or explicit width",
    values: { "flex-grow": "0", "flex-shrink": "0", "flex-basis": "auto" },
  },
  {
    id: "fill",
    label: "Fill",
    title: "Grow to fill the container",
    values: { "flex-grow": "1", "flex-shrink": "1", "flex-basis": "0%" },
  },
  {
    id: "hug",
    label: "Hug",
    title: "Shrink to fit content",
    values: { "flex-grow": "0", "flex-shrink": "1", "flex-basis": "auto" },
  },
]

const ZERO_BASIS = new Set(["0", "0%", "0px"])

function detectPreset(
  grow: string,
  shrink: string,
  basis: string
): PresetId | null {
  if (grow === "0" && shrink === "0" && basis === "auto") return "auto"
  if (grow === "1" && shrink === "1" && ZERO_BASIS.has(basis)) return "fill"
  if (grow === "0" && shrink === "1" && basis === "auto") return "hug"
  return null
}

export default function FlexPresetField({
  property,
}: {
  property: PropertyComposite
}) {
  const subs = property.getProperties()
  const grow = String(
    subs.find((p) => p.getName() === "flex-grow")?.getValue() ?? ""
  )
  const shrink = String(
    subs.find((p) => p.getName() === "flex-shrink")?.getValue() ?? ""
  )
  const basis = String(
    subs.find((p) => p.getName() === "flex-basis")?.getValue() ?? ""
  )
  const active = detectPreset(grow, shrink, basis)

  const apply = (id: PresetId) => {
    const preset = PRESETS.find((p) => p.id === id)
    if (!preset) return
    for (const sub of subs) {
      const name = sub.getName() as keyof Preset["values"]
      const next = preset.values[name]
      if (next != null) sub.upValue(next)
    }
  }

  return (
    <ToggleGroup
      value={active ? [active] : []}
      onValueChange={(values: string[]) => {
        const next = values[0] as PresetId | undefined
        if (next) apply(next)
      }}
      aria-label="Flex preset"
      className="w-full"
    >
      {PRESETS.map((p) => (
        <ToggleGroupItem
          key={p.id}
          value={p.id}
          aria-label={p.label}
          title={p.title}
          className="min-w-0 flex-1 px-2 py-1 text-xs"
        >
          {p.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
