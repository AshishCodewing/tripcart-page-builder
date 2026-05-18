"use client"

import type { PropertySelect, SelectOption } from "grapesjs"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn, humanizeLabel } from "@/lib/utils"

import { OPTION_ICONS } from "./option-icons"
import SelectField from "./select-field"
import { useStyleContext } from "./use-style-context"

const SENTINEL = "__radio_unset__"

// Properties whose icons depend on the relevant flex container's axis.
// `align-self` looks at the parent (it's a flex-child property), the others
// at the element's own flex-direction.
const FLEX_AXIS_OWN = new Set([
  "justify-content",
  "align-items",
  "align-content",
])
const FLEX_AXIS_PARENT = new Set(["align-self"])

// In column-flow the main and cross axes swap orientation, so we rotate the
// horizontal-family / vertical-family icons accordingly. Justify rotates
// clockwise (left→top reads as start), Align rotates counter-clockwise so
// "start" still visually points to the cross-axis start (top→left).
function getIconRotation(propName: string, direction: string): string {
  if (direction !== "column" && direction !== "column-reverse") return ""
  if (propName === "justify-content") return "rotate-90"
  if (
    propName === "align-items" ||
    propName === "align-self" ||
    propName === "align-content"
  ) {
    return "-rotate-90"
  }
  return ""
}

// grapesjs-style-bg's options put the SVG icon HTML in `label` and the
// human-readable name in `title`. GrapesJS's own properties (text-align,
// flex-direction, …) use `label` for the friendly text, so we prefer `title`
// when present, fall back to `getOptionLabel`, then to the option id. The
// HTML guard catches any other plugin that follows the SVG-in-label pattern.
function getOptionTooltip(
  property: PropertySelect,
  opt: SelectOption
): string {
  const id = property.getOptionId(opt)
  const candidate = opt.title || property.getOptionLabel(opt) || id
  if (candidate.trim().startsWith("<")) return humanizeLabel(id)
  return humanizeLabel(candidate)
}

export default function RadioField({
  property,
}: {
  property: PropertySelect
}) {
  const ctx = useStyleContext()
  const value = String(property.getValue() ?? "")
  const options = property.getOptions() ?? []
  const propName = property.getName()
  const propIcons = OPTION_ICONS[propName]
  const allHaveIcons =
    !!propIcons &&
    options.length > 0 &&
    options.every((opt) => propIcons[property.getOptionId(opt)])

  // No clean icon set for this property (eg. position) — fall back to the
  // Select dropdown so the field reads the same way as Display.
  if (!allHaveIcons) {
    return <SelectField property={property} />
  }

  const direction = FLEX_AXIS_PARENT.has(propName)
    ? ctx.parentFlexDirection
    : FLEX_AXIS_OWN.has(propName)
      ? ctx.flexDirection
      : "row"
  const rotation = getIconRotation(propName, direction)

  return (
    <TooltipProvider delay={500}>
      <ToggleGroup
        value={[value || SENTINEL]}
        onValueChange={(values: string[]) => {
          const next = values[0]
          if (!next || next === SENTINEL) return
          property.upValue(next)
        }}
        aria-label={property.getLabel()}
        className="w-full"
        variant="outline"
      >
        {options.map((opt: SelectOption) => {
          const id = property.getOptionId(opt)
          const label = getOptionTooltip(property, opt)
          const Icon = propIcons![id]

          return (
            <Tooltip key={id}>
              <TooltipTrigger
                render={
                  <ToggleGroupItem
                    value={id}
                    aria-label={label}
                    className="min-w-0 flex-1 px-2 py-1 text-xs"
                  >
                    <Icon
                      className={cn(
                        "size-3.5 transition-transform duration-150 motion-reduce:transition-none",
                        rotation
                      )}
                      aria-hidden="true"
                    />
                  </ToggleGroupItem>
                }
              />
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          )
        })}
      </ToggleGroup>
    </TooltipProvider>
  )
}
