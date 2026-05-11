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

/** [src relative to project root, dst relative to project root] */
const copies = [
  ["node_modules/open-props/sizes.min.css",      "public/vendor/open-props-sizes.min.css"],
  ["node_modules/open-props/fonts.min.css",      "public/vendor/open-props-fonts.min.css"],
  ["node_modules/open-props/borders.min.css",    "public/vendor/open-props-borders.min.css"],
  ["node_modules/open-props/colors-hsl.min.css", "public/vendor/open-props-colors-hsl.min.css"],
]

for (const [src, dst] of copies) {
  const from = resolve(root, src)
  const to = resolve(root, dst)
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
  console.log(`vendor: ${src} -> ${dst}`)
}
