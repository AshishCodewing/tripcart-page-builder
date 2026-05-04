/**
 * Reactive source of truth for the active theme.
 *
 * Anyone (panel UI, plugin, future plugin) can:
 *
 * - read the current snapshot (getSnapshot)
 * - mutate a single token (setToken)
 * - swap whole categories from a preset (applyPreset)
 * - reset to the bundled defaults (resetTheme)
 * - subscribe to changes (subscribe)
 *
 * `activePresetId` records which preset card (if any) is currently the source
 * of truth for a given preset category. Manual token edits clear it so the UI
 * never claims a preset is active when the tokens have drifted.
 *
 * The design-system plugin subscribes to this store and re-injects the canvas
 * :root CSS variables on every change. Panel UI subscribes via useTheme() /
 * useThemeSelector() to render current values.
 */

import { defaultTokens, type TokenSchema, type TokenValue } from "@/lib/tokens"
import type { Preset, PresetCategory } from "@/lib/theme/presets"

export type ActivePresetId = Partial<Record<PresetCategory, string>>

export type ThemeSnapshot = {
  theme: TokenSchema
  activePresetId: ActivePresetId
}

type Listener = (snapshot: ThemeSnapshot) => void

const PRESET_CATEGORIES: ReadonlySet<string> = new Set<PresetCategory>([
  "colors",
  "typography",
])

const cloneTheme = (theme: TokenSchema): TokenSchema => structuredClone(theme)

let snapshot: ThemeSnapshot = {
  theme: cloneTheme(defaultTokens),
  activePresetId: {},
}
const listeners = new Set<Listener>()

const emit = (): void => {
  for (const fn of listeners) fn(snapshot)
}

export const themeStore = {
  getSnapshot: (): ThemeSnapshot => snapshot,
  getTheme: (): TokenSchema => snapshot.theme,
  getActivePresetId: (): ActivePresetId => snapshot.activePresetId,

  setTheme(next: TokenSchema): void {
    snapshot = { theme: next, activePresetId: {} }
    emit()
  },

  setToken(category: keyof TokenSchema, key: string, value: string): void {
    const group = snapshot.theme[category] as Record<string, TokenValue>
    const existing = group[key]
    if (!existing) return

    const nextActive = PRESET_CATEGORIES.has(category)
      ? (() => {
          if (snapshot.activePresetId[category as PresetCategory] === undefined) {
            return snapshot.activePresetId
          }
          const { [category as PresetCategory]: _, ...rest } =
            snapshot.activePresetId
          return rest
        })()
      : snapshot.activePresetId

    snapshot = {
      theme: {
        ...snapshot.theme,
        [category]: { ...group, [key]: { ...existing, value } },
      },
      activePresetId: nextActive,
    }
    emit()
  },

  applyPreset(preset: Preset): void {
    const next = cloneTheme(snapshot.theme)
    for (const [cat, group] of Object.entries(preset.tokens)) {
      if (!group) continue
      const target = next[cat as keyof TokenSchema] as Record<
        string,
        TokenValue
      >
      for (const [key, token] of Object.entries(group)) {
        target[key] = { ...target[key], ...token }
      }
    }
    snapshot = {
      theme: next,
      activePresetId: {
        ...snapshot.activePresetId,
        [preset.category]: preset.id,
      },
    }
    emit()
  },

  resetTheme(): void {
    snapshot = { theme: cloneTheme(defaultTokens), activePresetId: {} }
    emit()
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
}
