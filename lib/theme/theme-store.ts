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
import type { FontSizeToken, Theme, Token } from "@/lib/theme/schema"
import type { Preset } from "@/lib/theme/presets"

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

const getGroup = (
  theme: Theme,
  category: PresetCategory
): Token[] | undefined => {
  const s = theme.settings
  switch (category) {
    case "color":
      return s.color?.palette
    case "font-family":
      return s.typography?.fontFamilies
    case "font-size":
      return s.typography?.fontSizes
    case "font-weight":
      return s.typography?.fontWeights
    case "line-height":
      return s.typography?.lineHeights
    case "letter-spacing":
      return s.typography?.letterSpacings
    case "spacing":
      return s.spacing?.sizes
    case "radius":
      return s.border?.radii
    case "border-width":
      return s.border?.widths
    case "border-style":
      return s.border?.styles
    case "shadow":
      return s.shadow?.presets
  }
}

const withGroup = (
  theme: Theme,
  category: PresetCategory,
  tokens: Token[]
): Theme => {
  const s = theme.settings
  switch (category) {
    case "color":
      return {
        ...theme,
        settings: { ...s, color: { ...s.color, palette: tokens } },
      }
    case "font-family":
      return {
        ...theme,
        settings: {
          ...s,
          typography: { ...s.typography, fontFamilies: tokens },
        },
      }
    case "font-size":
      return {
        ...theme,
        settings: {
          ...s,
          typography: {
            ...s.typography,
            fontSizes: tokens as FontSizeToken[],
          },
        },
      }
    case "font-weight":
      return {
        ...theme,
        settings: {
          ...s,
          typography: { ...s.typography, fontWeights: tokens },
        },
      }
    case "line-height":
      return {
        ...theme,
        settings: {
          ...s,
          typography: { ...s.typography, lineHeights: tokens },
        },
      }
    case "letter-spacing":
      return {
        ...theme,
        settings: {
          ...s,
          typography: { ...s.typography, letterSpacings: tokens },
        },
      }
    case "spacing":
      return {
        ...theme,
        settings: { ...s, spacing: { ...s.spacing, sizes: tokens } },
      }
    case "radius":
      return {
        ...theme,
        settings: { ...s, border: { ...s.border, radii: tokens } },
      }
    case "border-width":
      return {
        ...theme,
        settings: { ...s, border: { ...s.border, widths: tokens } },
      }
    case "border-style":
      return {
        ...theme,
        settings: { ...s, border: { ...s.border, styles: tokens } },
      }
    case "shadow":
      return {
        ...theme,
        settings: { ...s, shadow: { ...s.shadow, presets: tokens } },
      }
  }
}

const clearActiveFor = (
  active: ActivePresetId,
  category: PresetCategory
): ActivePresetId => {
  if (active[category] === undefined) return active
  const rest = { ...active }
  delete rest[category]
  return rest
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
    const updates = new Map(preset.tokens.map((t) => [t.slug, t]))

    const nextTokens: Token[] = existing.map((t) => {
      const u = updates.get(t.slug)
      return u ? { ...t, ...u } : t
    })
    // Append preset tokens whose slug wasn't already registered.
    for (const t of preset.tokens) {
      if (!nextTokens.some((x) => x.slug === t.slug)) nextTokens.push(t)
    }

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
