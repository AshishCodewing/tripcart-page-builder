/**
 * React subscriptions to themeStore.
 *
 * - useTheme()              -> the full TokenSchema. Re-renders on any token change.
 * - useThemeSelector(sel)   -> selector-based read. Re-renders only when the
 *                              selected slice's reference changes. Use this for
 *                              individual tokens or activePresetId reads so
 *                              one panel's edits don't re-render every other panel.
 *
 * The store preserves references for unchanged subtrees on setToken, so
 * selectors like `(s) => s.theme.colors.primary` only fire when that token
 * actually changes. applyPreset clones the whole theme, so all selectors fire
 * on preset application — that's intentional and matches user intent.
 */

import { useRef, useSyncExternalStore } from "react"
import { themeStore, type ThemeSnapshot } from "@/lib/theme/theme-store"
import type { TokenSchema } from "@/lib/tokens"

export const useTheme = (): TokenSchema =>
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
