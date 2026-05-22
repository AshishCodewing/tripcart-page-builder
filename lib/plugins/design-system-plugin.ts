/**
 * Registers the design system layer in GrapesJS.
 *
 * - On editor load, hydrates `themeStore` from the persisted `:root`
 *   CssRule if storage already has one (so user customizations survive
 *   reloads), then re-injects the merged theme to guarantee the rule is
 *   present and marked protected.
 * - Subscribes to `themeStore` and re-injects on every change so panel
 *   edits flow through to the canvas with no extra wiring at the call
 *   site.
 *
 * The injected `:root` rule is built by `compileTheme`, which emits the
 * new `--tc--preset--<category>--<slug>` variable names alongside the
 * legacy `--theme-<slug>` / `--font-<slug>` aliases. The aliases keep
 * pattern templates and shadcn bindings resolving until they're swept
 * onto the new names in a follow-up PR.
 *
 * Note on export contract: tokens reference Open Props variables by
 * name (e.g. `var(--gray-9)`). Any environment that renders authored
 * content must also load Open Props, or the variables won't resolve.
 */

import type { Editor } from "grapesjs"
import { compileTheme } from "@/lib/theme/compile"
import { themeStore } from "@/lib/theme/theme-store"
import { tokensFromStored } from "@/lib/tokens"
import type { Theme } from "@/lib/theme/schema"

export const designSystemPlugin = (editor: Editor): void => {
  const inject = (theme: Theme): void => {
    const { rootVars } = compileTheme(theme)
    editor.CssComposer.setRule(":root", rootVars)
    const rule = editor.CssComposer.getRule(":root")
    // `protected` is a CssRule model attribute (Backbone-backed); set
    // via `.set()` so users can't delete the rule from the Style Manager.
    if (rule) rule.set("protected", true)
  }

  let unsubscribe: (() => void) | null = null

  editor.on("load", () => {
    const stored = editor.CssComposer.getRule(":root")
    if (stored) {
      const styles = stored.getStyle() as Record<string, string>
      const merged = tokensFromStored(themeStore.getTheme(), styles)
      themeStore.setTheme(merged)
    }
    inject(themeStore.getTheme())
    unsubscribe = themeStore.subscribe((snapshot) => inject(snapshot.theme))
  })

  editor.on("destroy", () => {
    unsubscribe?.()
    unsubscribe = null
  })
}
