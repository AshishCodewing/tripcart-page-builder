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
 * The injected `:root` rule is built by `compileTheme`, which emits
 * the `--tc--preset--<category>--<slug>` variable names. Consumers
 * (pattern templates, the Tailwind `font-heading` bridge in globals.css,
 * the Style Manager pickers) all read those names directly.
 *
 * `compileTheme.rules` adds element- and component-level defaults
 * (`body`, `button`, `a`, `h1`-`h6`, `[data-gjs-type="…"]`, …) on top
 * of the `:root` variables. Like `:root`, these are marked `protected`
 * — the `tc-local` storage adapter keys off that flag to keep
 * tenant-wide theme rules from being duplicated into every per-page
 * project blob.
 *
 * The Style Manager's componentFirst mode (configured in editor-shell)
 * means user edits to a specific component create new ID/class-scoped
 * rules; they don't mutate these tag-level theme defaults. Selecting
 * a protected rule directly is still possible but discouraged — any
 * edit gets overwritten on the next theme recompile.
 *
 * A closure-scoped `managedSelectors` Set tracks every selector we've
 * ever written, so removing a style block from the theme on a
 * subsequent compile cycle clears its declarations from the canvas
 * (we re-setRule the old selector with an empty style map).
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
  let managedSelectors = new Set<string>()

  const inject = (theme: Theme): void => {
    const { rootVars, rules } = compileTheme(theme)

    // :root variables — protected so users can't accidentally delete
    // the rule from the Style Manager.
    editor.CssComposer.setRule(":root", rootVars)
    const rootRule = editor.CssComposer.getRule(":root")
    if (rootRule) rootRule.set("protected", true)

    // Element / component style rules. Marked protected so the
    // tc-local storage adapter filters them out of per-page blobs.
    const incoming = new Set<string>()
    for (const rule of rules) {
      editor.CssComposer.setRule(rule.selector, rule.style)
      const ref = editor.CssComposer.getRule(rule.selector)
      if (ref) ref.set("protected", true)
      incoming.add(rule.selector)
    }

    // Clear selectors we wrote previously that aren't in this compile.
    for (const stale of managedSelectors) {
      if (!incoming.has(stale)) {
        editor.CssComposer.setRule(stale, {})
      }
    }
    managedSelectors = incoming
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
