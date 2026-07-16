"use client"

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useThemeSelector } from "@/hooks/use-theme"
import { themeStore } from "@/lib/theme/theme-store"
import { COLOR_PRESETS, type Preset } from "@/lib/theme/presets"

const COLOR_PRESETS_BY_ID = new Map<string, Preset>(
  COLOR_PRESETS.map((p) => [p.id, p])
)

const handleColorChange = (value: unknown): void => {
  if (typeof value !== "string") return
  const preset = COLOR_PRESETS_BY_ID.get(value)
  if (preset) themeStore.applyPreset(preset)
}

/**
 * Designer-curated color palette picker. Reads/writes `themeStore`
 * directly; the owning route's shell hydrates the store from the
 * tenant's persisted theme and commits changes back.
 */
export default function ColorPaletteGrid() {
  const selectedColorId = useThemeSelector(
    (s) => s.activePresetId.color ?? null
  )

  return (
    <RadioGroup
      className="grid grid-cols-2 gap-2 md:grid-cols-3"
      value={selectedColorId}
      onValueChange={handleColorChange}
    >
      {COLOR_PRESETS.map((p) => (
        <FieldLabel
          key={p.id}
          htmlFor={`color-${p.id}`}
          className="rounded-lg border p-3 has-focus-visible:ring-2 has-focus-visible:ring-ring/50"
        >
          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle className="font-medium">{p.name}</FieldTitle>
              {p.description && (
                <FieldDescription>{p.description}</FieldDescription>
              )}
              {p.swatches && (
                <div className="flex gap-1">
                  {p.swatches.map((swatch, i) => (
                    <span
                      key={i}
                      className="h-3.5 w-3.5 rounded outline outline-accent"
                      style={{ background: swatch }}
                    />
                  ))}
                </div>
              )}
              <RadioGroupItem
                value={p.id}
                id={`color-${p.id}`}
                className="sr-only"
              />
            </FieldContent>
          </Field>
        </FieldLabel>
      ))}
    </RadioGroup>
  )
}
