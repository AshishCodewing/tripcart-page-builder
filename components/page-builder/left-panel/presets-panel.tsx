"use client"

import { SidebarContent, SidebarHeader } from "@/components/ui/sidebar"
import { PanelBackButton } from "./panel-back-button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  COLOR_PRESETS,
  TYPOGRAPHY_PRESETS,
  type Preset,
} from "@/lib/theme/presets"
import { themeStore } from "@/lib/theme/theme-store"
import { useThemeSelector } from "@/hooks/use-theme"

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

export default function PresetsPanel() {
  const selectedColorId = useThemeSelector(
    (s) => s.activePresetId.colors ?? null
  )
  const selectedTypographyId = useThemeSelector(
    (s) => s.activePresetId.typography ?? null
  )

  return (
    <>
      <SidebarHeader className="border-b">
        <PanelBackButton>Browser Styles</PanelBackButton>
        <p className="my-2 text-xs text-balance">
          Choose a variation to change the look of the site.
        </p>
      </SidebarHeader>
      <SidebarContent>
        <div className="space-y-2 px-2 py-2">
          <h2 className="my-2 text-xs font-semibold text-muted-foreground uppercase">
            Color Palettes
          </h2>
          <RadioGroup
            className="grid grid-cols-2"
            value={selectedColorId}
            onValueChange={handleColorChange}
          >
            {COLOR_PRESETS.map((p) => (
              <FieldLabel key={p.id} htmlFor={p.id}>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>{p.name}</FieldTitle>
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
                      id={p.id}
                      className="sr-only"
                    />
                  </FieldContent>
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>

          <h2 className="my-2 text-xs font-semibold text-muted-foreground uppercase">
            Typography
          </h2>
          <RadioGroup
            className="grid grid-cols-1"
            value={selectedTypographyId}
            onValueChange={handleTypographyChange}
          >
            {TYPOGRAPHY_PRESETS.map((t) => (
              <FieldLabel key={t.id} htmlFor={t.id}>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>{t.name}</FieldTitle>
                    {t.description && (
                      <FieldDescription>{t.description}</FieldDescription>
                    )}
                    <RadioGroupItem
                      value={t.id}
                      id={t.id}
                      className="sr-only"
                    />
                  </FieldContent>
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
        </div>
      </SidebarContent>
    </>
  )
}
