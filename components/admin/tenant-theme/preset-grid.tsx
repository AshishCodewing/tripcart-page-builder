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
import {
  COLOR_PRESETS,
  TYPOGRAPHY_PRESETS,
  type Preset,
} from "@/lib/theme/presets"

const COLOR_PRESETS_BY_ID = new Map<string, Preset>(
  COLOR_PRESETS.map((p) => [p.id, p])
)
const TYPOGRAPHY_PRESETS_BY_ID = new Map<string, Preset>(
  TYPOGRAPHY_PRESETS.map((p) => [p.id, p])
)

const applyFrom =
  (lookup: Map<string, Preset>) =>
  (value: unknown): void => {
    if (typeof value !== "string") return
    const preset = lookup.get(value)
    if (preset) themeStore.applyPreset(preset)
  }

const handleColorChange = applyFrom(COLOR_PRESETS_BY_ID)
const handleTypographyChange = applyFrom(TYPOGRAPHY_PRESETS_BY_ID)

/**
 * Designer-curated color palette + typography pairing pickers.
 *
 * Reads/writes `themeStore` directly so the same component works in any
 * surface that wants to expose preset selection. The owning route is
 * responsible for initializing `themeStore` from the tenant's persisted
 * theme on mount and committing back to storage via the tenant theme
 * action — this grid only handles the picking UI.
 */
export default function PresetGrid() {
  const selectedColorId = useThemeSelector(
    (s) => s.activePresetId.color ?? null
  )
  const selectedTypographyId = useThemeSelector(
    (s) => s.activePresetId["font-family"] ?? null
  )

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase">
          Color Palettes
        </h2>
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
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase">
          Typography
        </h2>
        <RadioGroup
          className="grid grid-cols-2 gap-2 md:grid-cols-3"
          value={selectedTypographyId}
          onValueChange={handleTypographyChange}
        >
          {TYPOGRAPHY_PRESETS.map((t) => {
            const headingFont = t.tokens.find(
              (tok) => tok.slug === "heading"
            )?.value
            const bodyFont = t.tokens.find((tok) => tok.slug === "body")?.value
            return (
              <FieldLabel
                key={t.id}
                htmlFor={`typography-${t.id}`}
                className="rounded-lg border p-3 has-focus-visible:ring-2 has-focus-visible:ring-ring/50"
              >
                <Field orientation="horizontal">
                  <FieldContent className="gap-1">
                    <FieldTitle
                      className="font-medium"
                      style={{ fontFamily: headingFont }}
                    >
                      {t.name}
                    </FieldTitle>
                    {t.description && (
                      <FieldDescription
                        className="text-xs"
                        style={{ fontFamily: bodyFont }}
                      >
                        {t.description}
                      </FieldDescription>
                    )}
                    <RadioGroupItem
                      value={t.id}
                      id={`typography-${t.id}`}
                      className="sr-only"
                    />
                  </FieldContent>
                </Field>
              </FieldLabel>
            )
          })}
        </RadioGroup>
      </section>
    </div>
  )
}
