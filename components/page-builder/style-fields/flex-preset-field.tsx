"use client"

import * as React from "react"
import type { PropertyComposite } from "grapesjs"
import {
  ChevronsLeftRight,
  ChevronsRightLeft,
  SquareDashed,
  X,
  type LucideIcon,
} from "lucide-react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Studio SDK-style flex preset for flex children. The three real presets
// (Auto / Fill / Hug) write through to the composite's flex-grow, flex-shrink
// and flex-basis sub-properties via PropertyComposite#getProperties() →
// Property#upValue() (per https://grapesjs.com/docs/api/property.html#upvalue).
// The Custom slot is a controlled "advanced" toggle — it's the parent's job
// to render the raw sub-property rows when this slot is the active one.
export type FlexPresetId = "auto" | "fill" | "hug"

type Preset = {
  id: FlexPresetId
  label: string
  title: string
  icon: LucideIcon
  values: { "flex-grow": string; "flex-shrink": string; "flex-basis": string }
}

const PRESETS: Preset[] = [
  {
    id: "auto",
    label: "Auto",
    title: "Size from content or explicit width",
    icon: X,
    values: { "flex-grow": "0", "flex-shrink": "0", "flex-basis": "auto" },
  },
  {
    id: "fill",
    label: "Fill",
    title: "Grow to fill available space",
    icon: ChevronsLeftRight,
    values: { "flex-grow": "1", "flex-shrink": "1", "flex-basis": "0%" },
  },
  {
    id: "hug",
    label: "Hug",
    title: "Shrink to fit content",
    icon: ChevronsRightLeft,
    values: { "flex-grow": "0", "flex-shrink": "1", "flex-basis": "auto" },
  },
]

const ZERO_BASIS = new Set(["0", "0%", "0px"])

function readSubValue(property: PropertyComposite, name: string): string {
  const sub = property.getProperties().find((p) => p.getName() === name)
  return String(sub?.getValue() ?? "")
}

export function getFlexPreset(
  property: PropertyComposite
): FlexPresetId | null {
  const grow = readSubValue(property, "flex-grow")
  const shrink = readSubValue(property, "flex-shrink")
  const basis = readSubValue(property, "flex-basis")
  if (grow === "0" && shrink === "0" && basis === "auto") return "auto"
  if (grow === "1" && shrink === "1" && ZERO_BASIS.has(basis)) return "fill"
  if (grow === "0" && shrink === "1" && basis === "auto") return "hug"
  return null
}

type Props = {
  property: PropertyComposite
  /** When true, the Custom slot stays active even if the values match a preset. */
  customForced: boolean
  onSelect: (id: FlexPresetId | "custom") => void
}

export default function FlexPresetField({
  property,
  customForced,
  onSelect,
}: Props) {
  const subs = property.getProperties()
  const preset = getFlexPreset(property)
  const active: FlexPresetId | "custom" =
    customForced || preset === null ? "custom" : preset

  const apply = (id: FlexPresetId): void => {
    const next = PRESETS.find((p) => p.id === id)
    if (!next) return
    for (const sub of subs) {
      const name = sub.getName() as keyof Preset["values"]
      const v = next.values[name]
      if (v != null) sub.upValue(v)
    }
  }

  return (
    <TooltipProvider delay={500}>
      <ToggleGroup
        value={[active]}
        variant="outline"
        onValueChange={(values: string[]) => {
          const next = values[0]
          if (!next) return
          if (next === "custom") {
            onSelect("custom")
            return
          }
          apply(next as FlexPresetId)
          onSelect(next as FlexPresetId)
        }}
        aria-label="Flex preset"
        className="w-full"
      >
        {PRESETS.map((p) => (
          <Tooltip key={p.id}>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  value={p.id}
                  aria-label={p.label}
                  className="min-w-0 flex-1 px-2 py-1"
                >
                  <p.icon className="size-3.5" aria-hidden="true" />
                </ToggleGroupItem>
              }
            />
            <TooltipContent>{p.title}</TooltipContent>
          </Tooltip>
        ))}
        <Tooltip>
          <TooltipTrigger
            render={
              <ToggleGroupItem
                value="custom"
                aria-label="Custom"
                className="min-w-0 flex-1 px-2 py-1"
              >
                <SquareDashed className="size-3.5" aria-hidden="true" />
              </ToggleGroupItem>
            }
          />
          <TooltipContent>Custom</TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </TooltipProvider>
  )
}
