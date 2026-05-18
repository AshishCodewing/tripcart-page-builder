/**
 * Mirrors `themeStore` tokens onto `document.documentElement` as
 * `--theme-*` / `--font-*` CSS variables.
 *
 * The canvas iframe already gets these via `designSystemPlugin` (which writes
 * a `:root` CssRule into CssComposer). But anything rendered in the outer
 * React document — Style Manager swatches, popovers, panel previews — also
 * needs them so values like `var(--theme-primary)` can resolve there.
 *
 * Scope: applied to the document root because shadcn primitives (Popover,
 * Tooltip, etc.) portal into <body>, so a scoped wrapper wouldn't cover them.
 * On unmount we remove every key we wrote so other routes (preview, blog)
 * aren't polluted by editor-only tokens.
 */

import { useEffect } from "react"

import { themeStore } from "@/lib/theme/theme-store"
import { tokensToStyleObject } from "@/lib/tokens"

export function useApplyThemeVars(): void {
  useEffect(() => {
    if (typeof document === "undefined") return
    const root = document.documentElement
    const applied = new Set<string>()

    const apply = (): void => {
      const styles = tokensToStyleObject(themeStore.getTheme())
      for (const [name, value] of Object.entries(styles)) {
        root.style.setProperty(name, value)
        applied.add(name)
      }
    }

    apply()
    const unsubscribe = themeStore.subscribe(apply)

    return () => {
      unsubscribe()
      for (const name of applied) root.style.removeProperty(name)
    }
  }, [])
}
