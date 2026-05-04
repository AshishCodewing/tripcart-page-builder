/**
 * Reactive source of truth for the active theme.
 * 
 * Anyone (panel UI, plugin, future plugin) can:
 * 
 * - read the current theme (getTheme)
 * - mutate a single token (setToken)
 * - swap whole categories from a preset (applyPreset)
 * - reset to the bundled defaults (resetTheme)
 * - subscribe to chagnes (subcribe)
 * 
 * The design-system plugin subscribe to this store and re-injects the canvas :root CSS variables on every change. The Theme panel subscribe via useTheme() to render current values.
 */

import { defaultTokens, type TokenSchema, type TokenValue } from "@/lib/tokens"
import type { Preset } from "@/lib/theme/presets"

type Listener = (theme: TokenSchema) => void

const cloneTheme = (theme: TokenSchema): TokenSchema => structuredClone(theme)
let theme: TokenSchema = cloneTheme(defaultTokens)
const listeners = new Set<Listener>()

const emit = (): void => {
  for (const fn of listeners) fn(theme)
}

export const themeStore = {
  getTheme: (): TokenSchema => theme,

  setTheme(next: TokenSchema): void {
    theme = next
    emit()
  },

  setToken(
    category: keyof TokenSchema,
    key: string,
    value: string,
  ): void {
    const group = theme[category] as Record<string, TokenValue>
    const existing = group[key]
    if (!existing) return
    theme = {
      ...theme,
      [category]: { ...group, [key]: { ...existing, value}},
    }
    emit()
  },
  
  applyPreset(preset: Preset): void {
    const next = cloneTheme(theme)
    for (const [cat, group] of Object.entries(preset.tokens)) {
      if (!group) continue
      const target = next[cat as keyof TokenSchema] as Record<string, TokenValue>
      for (const [key, token] of Object.entries(group)) {
        target[key] = { ...target[key], ...token }
      }
    }
    theme = next
    emit()
  },

  resetTheme(): void {
    theme = cloneTheme(defaultTokens)
    emit()
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },
}
