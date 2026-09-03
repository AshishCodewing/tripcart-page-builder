"use client"

import * as React from "react"
import type { Editor } from "grapesjs"

import { cssVarToStyleRef } from "@/lib/theme/style-ref"
import { CSS_TO_PATH } from "@/lib/theme/style-css-map"
import { targetSelector, type StyleTarget } from "@/lib/theme/style-targets"
import { themeStore } from "@/lib/theme/theme-store"

type StyleableModel = { getStyle: () => Record<string, string> }

/**
 * Points the Style Manager at the theme rule for `target`, and folds edits of
 * that rule back into the theme document.
 *
 * `StyleManager.select(selector)` finds or creates the CssRule for a selector
 * string and routes every property edit to it — and the selector we pass is the
 * one `compileTheme` emits, so the panel edits the theme's own rule rather than
 * a component-scoped copy.
 *
 * Write-back guards two hazards:
 *   - the round trip (theme write → designSystemPlugin re-injects → the rule
 *     changes again) is broken by `applying`, plus `setStyleValue`'s no-op on an
 *     unchanged value;
 *   - `StyleManager.upAll` re-selects from the component selection on several
 *     events, which with no selected component clears the target; re-asserting
 *     when it comes back empty is self-limiting.
 */
export const useThemeStyleSync = (
  editor: Editor | null,
  target: StyleTarget | null
): void => {
  const selector = target ? targetSelector(target) : undefined
  const applying = React.useRef(false)

  React.useEffect(() => {
    if (!editor || !target || !selector) return
    const sm = editor.StyleManager

    sm.select(selector)

    const reassert = (): void => {
      if (sm.getSelected() == null) sm.select(selector)
    }

    const onStyleChange = (model: StyleableModel, property: string): void => {
      if (applying.current) return
      const path = CSS_TO_PATH[property]
      if (!path) return

      const raw = model.getStyle()[property]
      const value =
        typeof raw === "string" && raw !== ""
          ? cssVarToStyleRef(raw, themeStore.getTheme())
          : undefined

      applying.current = true
      try {
        themeStore.setStyleValue(target, path, value)
      } finally {
        applying.current = false
      }
    }

    editor.on("styleable:change", onStyleChange)
    editor.on("style:target", reassert)

    return () => {
      editor.off("styleable:change", onStyleChange)
      editor.off("style:target", reassert)
    }
  }, [editor, target, selector])
}
