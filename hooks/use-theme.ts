/**
 * React subscriptions to themeStore.
 *
 * - useTheme()              -> the full Theme. Re-renders on any token change.
 * - useThemeSelector(sel)   -> selector-based read. Re-renders only when the
 *                              selected slice's reference changes. Use this for
 *                              token-group or activePresetId reads so one
 *                              panel's edits don't re-render every other panel.
 *
 * The store preserves references for unchanged subtrees on setToken (only
 * the touched registry branch is rebuilt), so selectors like
 * `(s) => s.theme.settings.color?.palette` only fire when that group
 * actually changes. applyPreset rebuilds the affected category, so all
 * selectors over that branch fire on preset application — intentional.
 */

import { useRef, useSyncExternalStore } from "react"
import { themeStore, type ThemeSnapshot } from "@/lib/theme/theme-store"
import type { Theme } from "@/lib/theme/schema"

export const useTheme = (): Theme =>
  useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getTheme,
    themeStore.getTheme
  )

export const useThemeSelector = <T>(
  selector: (snapshot: ThemeSnapshot) => T
): T => {
  const cache = useRef<{ snap: ThemeSnapshot; out: T } | null>(null)

  const read = () => {
    const snap = themeStore.getSnapshot()
    if (cache.current && cache.current.snap === snap) {
      return cache.current.out
    }
    const out = selector(snap)
    cache.current = { snap, out }
    return out
  }

  return useSyncExternalStore(themeStore.subscribe, read, read)
}
