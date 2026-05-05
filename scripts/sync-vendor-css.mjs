// Copies vendored CSS files from node_modules into public/vendor/ and builds
// a Tailwind utility bundle for the GrapesJS canvas iframe. Both end up at
// stable URLs the canvas can load via `canvas.styles`. We don't rely on
// `?url` imports because Turbopack handles CSS as a side-effect import, not
// a URL — bundlers other than Vite don't return a usable href.
//
// Run via the predev / prebuild / postinstall lifecycle hooks in package.json.
import { copyFileSync, mkdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "..")

/** [src relative to project root, dst relative to project root] */
const copies = [
  [
    "node_modules/open-props/open-props.min.css",
    "public/vendor/open-props.min.css",
  ],
]

for (const [src, dst] of copies) {
  const from = resolve(root, src)
  const to = resolve(root, dst)
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
  console.log(`vendor: ${src} -> ${dst}`)
}

// Compile a Tailwind utility CSS bundle for the canvas iframe. The canvas
// document is detached from the host's stylesheet pipeline, so utilities
// (`flex`, `bg-primary`, `text-foreground`, …) used by pattern blocks won't
// resolve unless we explicitly load a compiled output. Reuses globals.css as
// the input so the @theme mapping + design tokens come along for the ride.
//
// NOTE: We pass --content directives via the source file. Tailwind v4 also
// auto-scans project files at build time. The output gets refreshed each run.
const tailwindBin = resolve(root, "node_modules/.bin/tailwindcss")
const tailwindIn = resolve(root, "app/globals.css")
const tailwindOut = resolve(root, "public/vendor/tailwind.css")
mkdirSync(dirname(tailwindOut), { recursive: true })
execFileSync(
  tailwindBin,
  ["-i", tailwindIn, "-o", tailwindOut, "--minify"],
  { stdio: "inherit", cwd: root }
)
console.log(`vendor: tailwind utilities -> public/vendor/tailwind.css`)
