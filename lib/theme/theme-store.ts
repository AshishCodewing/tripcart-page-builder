/**
 * Reactive source of truth for the active theme.
 *
 * Anyone (panel UI, plugin, future plugin) can:
 *
 * - read the current snapshot (getSnapshot)
 * - mutate a single token (setToken)
 * - swap a category from a preset (applyPreset)
 * - reset to the bundled defaults (resetTheme)
 * - subscribe to changes (subscribe)
 *
 * `activePresetId` records which preset card (if any) is currently the
 * source of truth for a given preset category. Manual token edits clear
 * the entry so the UI never claims a preset is active when the tokens
 * have drifted.
 *
 * The design-system plugin subscribes to this store and re-injects the
 * canvas :root CSS variables on every change via `compileTheme`. Panel
 * UI subscribes via useTheme() / useThemeSelector() to render current
 * values.
 *
 * Mutations preserve reference equality for unchanged paths
 * (`withGroup` surgically rebuilds only the touched branch), so
 * selectors over an unrelated subtree don't re-fire.
 */

import {
  defaultActivePresetId,
  defaultTheme,
  type ActivePresetId,
} from "@/lib/tokens"
import type { PresetCategory } from "@/lib/theme/compile"
import type { Theme } from "@/lib/theme/schema"
import type { Preset } from "@/lib/theme/presets"
import { getGroup, withGroup } from "@/lib/theme/token-paths"
import { clearActiveFor, mergePresetTokens } from "@/lib/theme/theme-mutations"

export type { ActivePresetId } from "@/lib/tokens"

export type ThemeSnapshot = {
  theme: Theme
  activePresetId: ActivePresetId
}

type Listener = (snapshot: ThemeSnapshot) => void

let snapshot: ThemeSnapshot = {
  theme: structuredClone(defaultTheme),
  activePresetId: { ...defaultActivePresetId },
}
const listeners = new Set<Listener>()

const emit = (): void => {
  for (const fn of listeners) fn(snapshot)
}

export const themeStore = {
  getSnapshot: (): ThemeSnapshot => snapshot,
  getTheme: (): Theme => snapshot.theme,
  getActivePresetId: (): ActivePresetId => snapshot.activePresetId,

  setTheme(next: Theme): void {
    snapshot = { theme: next, activePresetId: {} }
    emit()
  },

  setToken(category: PresetCategory, slug: string, value: string): void {
    const tokens = getGroup(snapshot.theme, category)
    if (!tokens) return
    const idx = tokens.findIndex((t) => t.slug === slug)
    if (idx === -1) return

    const nextTokens = [...tokens]
    nextTokens[idx] = { ...tokens[idx], value }

    snapshot = {
      theme: withGroup(snapshot.theme, category, nextTokens),
      activePresetId: clearActiveFor(snapshot.activePresetId, category),
    }
    emit()
  },

  /**
   * Recompute `activePresetId` by comparing the current theme's tokens
   * against the supplied preset library. A preset is marked active when
   * every one of its tokens exactly matches the current value for that
   * slug in the matching category.
   *
   * Used after `setTheme` (which wipes `activePresetId`) so the picker
   * highlight survives a server round-trip. False positives are possible
   * when hand-edited tokens coincidentally match a preset.
   */
  detectActivePresets(presets: readonly Preset[]): void {
    const next: ActivePresetId = {}
    for (const preset of presets) {
      const current = getGroup(snapshot.theme, preset.category)
      if (!current) continue
      const allMatch = preset.tokens.every((t) => {
        const found = current.find((c) => c.slug === t.slug)
        return found?.value === t.value
      })
      if (allMatch) next[preset.category] = preset.id
    }
    snapshot = { ...snapshot, activePresetId: next }
    emit()
  },

  applyPreset(preset: Preset): void {
    const existing = getGroup(snapshot.theme, preset.category) ?? []
    const nextTokens = mergePresetTokens(existing, preset.tokens)

    snapshot = {
      theme: withGroup(snapshot.theme, preset.category, nextTokens),
      activePresetId: {
        ...snapshot.activePresetId,
        [preset.category]: preset.id,
      },
    }
    emit()
  },

  resetTheme(): void {
    snapshot = {
      theme: structuredClone(defaultTheme),
      activePresetId: { ...defaultActivePresetId },
    }
    emit()
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
}
