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
import { TYPOGRAPHY_PRESETS, type Preset } from "@/lib/theme/presets"

const TYPOGRAPHY_PRESETS_BY_ID = new Map<string, Preset>(
  TYPOGRAPHY_PRESETS.map((p) => [p.id, p])
)

const handleTypographyChange = (value: unknown): void => {
  if (typeof value !== "string") return
  const preset = TYPOGRAPHY_PRESETS_BY_ID.get(value)
  if (preset) themeStore.applyPreset(preset)
}

/**
 * Designer-curated typography pairing picker. Reads/writes `themeStore`
 * directly; the owning route's shell hydrates the store from the
 * tenant's persisted theme and commits changes back.
 */
export default function TypographyGrid() {
  const selectedTypographyId = useThemeSelector(
    (s) => s.activePresetId["font-family"] ?? null
  )

  return (
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
  )
}
