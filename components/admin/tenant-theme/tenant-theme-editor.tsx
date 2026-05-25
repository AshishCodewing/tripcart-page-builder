"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useApplyThemeVars } from "@/hooks/use-apply-theme-vars"
import { updateTenantTheme } from "@/lib/cms/tenant-actions"
import { COLOR_PRESETS, TYPOGRAPHY_PRESETS } from "@/lib/theme/presets"
import { themeStore } from "@/lib/theme/theme-store"
import type { Theme } from "@/lib/theme/schema"

import PresetGrid from "./preset-grid"

const ALL_PRESETS = [...COLOR_PRESETS, ...TYPOGRAPHY_PRESETS]

type Props = {
  tenantId: string
  initialTheme: Theme
}

/**
 * Draft + explicit Save editor for a tenant's brand theme.
 *
 * `themeStore` is the runtime source of truth and the draft holder:
 * we hydrate it from `initialTheme` on mount and whenever the prop
 * changes (e.g., after a successful save triggers `router.refresh()`),
 * then let `PresetGrid` mutate it freely. `Save` reads the current
 * store snapshot and commits via the server action. `Discard` snaps
 * it back to the loaded `initialTheme` without a server round-trip.
 *
 * Cross-route side note: navigating away from this page leaves
 * `themeStore` in whatever state the user last touched. The editor
 * route mounts with its own `themeStore.setTheme(tenantTheme)` call,
 * so an unsaved draft never leaks into a page-builder session.
 */
export default function TenantThemeEditor({ tenantId, initialTheme }: Props) {
  useEffect(() => {
    themeStore.setTheme(initialTheme)
    themeStore.detectActivePresets(ALL_PRESETS)
  }, [initialTheme])

  useApplyThemeVars()

  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const onSave = (): void => {
    setError(null)
    const draft = themeStore.getTheme()
    startTransition(async () => {
      try {
        await updateTenantTheme(tenantId, draft)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed")
      }
    })
  }

  const onDiscard = (): void => {
    themeStore.setTheme(initialTheme)
    themeStore.detectActivePresets(ALL_PRESETS)
    setError(null)
  }

  return (
    <div className="space-y-6">
      <PresetGrid />

      <div className="flex items-center gap-3 border-t pt-4">
        <Button onClick={onSave} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onDiscard}
          disabled={pending}
        >
          Discard
        </Button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </div>
  )
}
