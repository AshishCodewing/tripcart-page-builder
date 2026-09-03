"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { StyleBookEntry } from "@/lib/theme/style-book"
import { getStyleSurface } from "@/lib/theme/style-surfaces"
import { statesFor, type StyleTarget } from "@/lib/theme/style-targets"

const ROOT = "__root"
const BASE = "__base"

// `:focus-visible` and `[aria-selected="true"]` don't read as labels.
const STATE_LABELS: Record<string, string> = {
  ":hover": "Hover",
  ":focus": "Focus",
  ":focus-visible": "Focus",
  ":active": "Active",
  ":visited": "Visited",
  '[aria-selected="true"]': "Selected",
}

const stateLabel = (state: string): string => STATE_LABELS[state] ?? state

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

type Props = {
  entry: StyleBookEntry
  target: StyleTarget
  variation: string | null
  part: string | null
  state: string | null
  onVariationChange: (next: string | null) => void
  onPartChange: (next: string | null) => void
  onStateChange: (next: string | null) => void
}

/**
 * Picks WHICH block of the theme the controls below are editing: an element's
 * style variation, a component's part, and in both cases the state.
 */
export default function TargetSelectors({
  entry,
  target,
  variation,
  part,
  state,
  onVariationChange,
  onPartChange,
  onStateChange,
}: Props) {
  const surface =
    entry.kind === "component" ? getStyleSurface(entry.type) : undefined
  const states = statesFor(target)

  return (
    <div className="space-y-3">
      {entry.kind === "element" && entry.variations.length > 1 && (
        <Row label="Style variation">
          <ToggleGroup
            variant="outline"
            value={[variation ?? ""]}
            onValueChange={(values: string[]) => {
              const next = values[0]
              if (next !== undefined) onVariationChange(next || null)
            }}
            aria-label="Style variation"
            className="flex-wrap"
          >
            {entry.variations.map((v) => (
              <ToggleGroupItem
                key={v.slug || "base"}
                value={v.slug}
                className="h-7 px-2 text-xs"
              >
                {v.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Row>
      )}

      {surface && (
        <Row label="Part">
          <Select
            value={part ?? ROOT}
            onValueChange={(next: string | null) =>
              onPartChange(!next || next === ROOT ? null : next)
            }
          >
            <SelectTrigger className="h-8 text-xs" aria-label="Part">
              {/* base-ui's Select.Value renders the raw value by default —
                  pass a children fn so the trigger shows "Tab bar" rather
                  than the part key "list". */}
              <SelectValue>
                {(value) =>
                  value === ROOT || value == null
                    ? surface.root.label
                    : (surface.parts[String(value)]?.label ?? String(value))
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROOT}>{surface.root.label}</SelectItem>
              {Object.entries(surface.parts).map(([name, decl]) => (
                <SelectItem key={name} value={name}>
                  {decl.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      )}

      {states.length > 0 && (
        <Row label="State">
          <ToggleGroup
            variant="outline"
            value={[state ?? BASE]}
            onValueChange={(values: string[]) => {
              const next = values[0]
              if (next !== undefined) onStateChange(next === BASE ? null : next)
            }}
            aria-label="State"
            className="flex-wrap"
          >
            <ToggleGroupItem value={BASE} className="h-7 px-2 text-xs">
              Default
            </ToggleGroupItem>
            {states.map((s) => (
              <ToggleGroupItem key={s} value={s} className="h-7 px-2 text-xs">
                {stateLabel(s)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Row>
      )}
    </div>
  )
}
