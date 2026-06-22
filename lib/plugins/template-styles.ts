/**
 * Apply a template's Style-Manager rules to the live editor's CSS model.
 *
 * Shared by the two template surfaces that need to surface a template's
 * `data.styles` (the §6 precisely-extracted subtree slice) in the
 * editor, with opposite persistence intents:
 *
 *  - §7 synced-ref canvas preview → `protect: true`. The rules render on
 *    canvas but are marked `protected`, so `filterProtectedStyles` /
 *    `tc-local` strip them from saved page data; the `template-ref`
 *    plugin re-applies them on every `editor.on("load")` (mirroring
 *    `designSystemPlugin`'s theme rules). They MUST go through the CSS
 *    model — not a raw iframe `<style>` element — because only the model
 *    is re-rendered into the canvas by GrapesJS on frame reload /
 *    navigation; a detached `<style>` silently disappears on reload.
 *
 *  - §8 unsynced block drop → `protect: false`. The dropped copy owns its
 *    styles, so they persist into `page.data` alongside the component.
 *
 * In both cases a rule whose selector+state+at-rule already exists in the
 * model is SKIPPED — never re-added or mutated. That:
 *   (a) stops a re-drop / reload from clobbering a user's Style-Manager
 *       edits with the template's defaults, and
 *   (b) guarantees we never flip a page-owned (unprotected) rule to
 *       protected and lose it on the next save — only rules that were
 *       genuinely absent before this call get the protected flag.
 *
 * Serialized via the same `CssComposer` the preview/publish render path
 * uses, so the canvas matches the published render exactly.
 */

import type { Editor } from "grapesjs"
import type { Rule } from "@/lib/plugins/react-renderer/project/types"
import { CssComposer } from "@/lib/plugins/react-renderer/project/parser"
import {
  getAtRule,
  selectorsToString,
} from "@/lib/plugins/react-renderer/project/css-helpers"

const ruleKey = (selectors: string, atRule: string): string =>
  `${selectors}|${atRule}`

export function applyTemplateStyles(
  editor: Editor,
  styles: Rule[] | undefined,
  opts: { protect: boolean }
): void {
  if (!Array.isArray(styles) || styles.length === 0) return

  const existing = new Set(
    editor.Css.getRules().map((r) =>
      ruleKey(r.selectorsToString(), r.getAtRule())
    )
  )

  const fresh = styles.filter(
    (r) => !existing.has(ruleKey(selectorsToString(r), getAtRule(r)))
  )
  if (fresh.length === 0) return

  const css = new CssComposer(fresh).getCssAsString()
  if (!css) return
  const added = editor.Css.addRules(css)

  if (opts.protect) {
    // Mark protected only rules that were absent before this call — never
    // an existing page rule that `addRules` may have merged into (a key
    // mismatch our filter didn't catch), which would strip it on save.
    for (const rule of added) {
      if (!existing.has(ruleKey(rule.selectorsToString(), rule.getAtRule()))) {
        rule.set("protected", true)
      }
    }
  }
}
