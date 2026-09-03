// Cache key for a tenant's compiled theme stylesheet URL.
//
// The preview serves the theme as an immutable, year-cached stylesheet, so
// the URL must change whenever the CSS does. A version counter bumped on
// save misses two other sources of change — a compiler change and, since
// `mergeThemeOverDefaults`, a change to the bundled defaults — and both
// left browsers on stale CSS until the tenant happened to save. Hashing
// the compiled output covers all three by construction.

import { cssContentKey } from "@/lib/plugins/react-renderer/project/css-helpers"
import { compiledThemeToCss, compileTheme } from "@/lib/theme/compile"
import type { Theme } from "@/lib/theme/schema"

export const themeStylesheetKey = (theme: Theme): string =>
  cssContentKey(compiledThemeToCss(compileTheme(theme)))
