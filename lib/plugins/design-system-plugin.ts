/**
 * Registers the design system layer in GrapesJS.
 *
 * - On editor load, hydrates `themeStore` from the persisted `:root` CssRule
 *   if storage already has one (so user customizations survive reloads),
 *   then re-injects the merged theme to guarantee the rule is present and
 *   marked protected.
 * - Subscribes to `themeStore` and re-injects on every change so panel edits
 *   flow through to the canvas with no extra wiring at the call site.
 *
 * Note on export contract: tokens reference Open Props variables by name
 * (e.g. `var(--gray-9)`). Any environment that renders authored content must
 * also load Open Props, or the variables won't resolve.
 */

import type { Editor } from "grapesjs"
import {
  tokensFromStyleObject,
  tokensToStyleObject,
  type TokenSchema,
} from "@/lib/tokens"
import { themeStore } from "@/lib/theme/theme-store"

export const designSystemPlugin = (editor: Editor): void => {
  const injectTokens = (tokens: TokenSchema): void => {
    const styles = tokensToStyleObject(tokens)
    editor.CssComposer.setRule(":root", styles)
    const rule = editor.CssComposer.getRule(":root")
    // `protected` is a CssRule model attribute (Backbone-backed); set via
    // `.set()` so users can't delete the rule from the Style Manager.
    if (rule) rule.set("protected", true)
  }

  let unsubscribe: (() => void) | null = null

  editor.on("load", () => {
    const stored = editor.CssComposer.getRule(":root")
    if (stored) {
      const styles = stored.getStyle() as Record<string, string>
      const merged = tokensFromStyleObject(themeStore.getTheme(), styles)
      themeStore.setTheme(merged)
    }
    injectTokens(themeStore.getTheme())
    unsubscribe = themeStore.subscribe((snapshot) =>
      injectTokens(snapshot.theme)
    )
  })

  editor.on("destroy", () => {
    unsubscribe?.()
    unsubscribe = null
  })
}
