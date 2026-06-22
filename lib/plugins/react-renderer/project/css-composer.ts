// Stringifier for the `styles` array in a project snapshot. Rebuilds plain
// rules + grouped media/at-rules into a single CSS string, mirroring how the
// live `editor.Css` module emits CSS. Used outside the editor (e.g. in a
// Next.js publish route) where pulling in the full editor is unwanted.
//
// The stateless CSS-building logic lives in ./css-helpers (free, testable
// functions); this class just holds the rule set and exposes the editor-shaped
// `Css` surface (getCssAsString) the renderer consumes.

import type { Rule } from "./types"
import { rulesToCss } from "./css-helpers"

export class CssComposer {
  private rules: Rule[]

  constructor(rules: Rule[]) {
    this.rules = rules
  }

  getAll(): Rule[] {
    return this.rules
  }

  getRulesByGroup(group: string): Rule[] {
    return this.rules.filter((r) => r.group === group)
  }

  getCssAsString(): string {
    return rulesToCss(this.rules)
  }
}
