import type { ProjectData } from "grapesjs"

import {
  cssContentKey,
  rulesToCss,
} from "@/lib/plugins/react-renderer/project/css-helpers"
import type { Rule } from "@/lib/plugins/react-renderer/project/types"
import { filterProtectedStyles } from "@/lib/plugins/tc-storage-adapter"

// Publish-time CSS artifact: the entity's `styles` rules compiled to a CSS
// string, stored on the row in lockstep with `data` (see plan 023). The
// artifact is deliberately UNRESOLVED — a page's artifact contains only its
// own rules; template-ref styles stay on their Template rows so a part edit
// never invalidates every consuming page. A future renderer resolves refs,
// then composes page CSS + each part's CSS.
//
// An entity whose `data` went through this pipeline always has a string
// artifact — "" when it has no rules. null in the DB means "predates the
// pipeline" and is repaired by `pnpm backfill:css`, not lazily.

export interface CssArtifact {
  css: string
  cssHash: string
}

// Accepts both artifact sources: a full ProjectData blob (Page/Post `data`)
// and the slim Template body `{ component, styles }` — both carry a
// top-level `styles` array, and filterProtectedStyles tolerates its
// absence. Protected (theme) rules are stripped defensively: editor saves
// arrive pre-filtered, but non-editor writers and legacy backfilled rows
// don't.
export function compileCssArtifact(data: object): CssArtifact {
  const filtered = filterProtectedStyles(data as ProjectData)
  const styles = (filtered as { styles?: Rule[] }).styles
  const css = Array.isArray(styles) ? rulesToCss(styles) : ""
  return { css, cssHash: cssContentKey(css) }
}
