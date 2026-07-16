// Copies vendored CSS files from node_modules into public/vendor/ at stable
// URLs the GrapesJS canvas iframe can load via `canvas.styles`. We don't rely
// on `?url` imports because Turbopack handles CSS as a side-effect import, not
// a URL — bundlers other than Vite don't return a usable href.
//
// Run via the predev / prebuild / postinstall lifecycle hooks in package.json.
import { copyFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "..")

/**
 * [src relative to project root, dst relative to project root]
 *
 * The full `open-props.min.css` is the superset the canvas needs: sizes, fonts,
 * borders, the raw color scale, shadows, and easings — everything the tenant
 * theme and `public/tc-normalize.css` reference. `colors-hsl` is loaded
 * alongside it because the theme tokens use `hsl(var(--gray-N-hsl))`, and the
 * `-hsl` triplets are NOT in `open-props.min.css`. This mirrors what the
 * preview layout (app/(preview)) imports, so both surfaces resolve identically.
 */
const copies = [
  [
    "node_modules/open-props/open-props.min.css",
    "public/vendor/open-props.min.css",
  ],
  [
    "node_modules/open-props/colors-hsl.min.css",
    "public/vendor/open-props-colors-hsl.min.css",
  ],
]

for (const [src, dst] of copies) {
  const from = resolve(root, src)
  const to = resolve(root, dst)
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
  console.log(`vendor: ${src} -> ${dst}`)
}
