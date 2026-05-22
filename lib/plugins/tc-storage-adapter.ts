/**
 * Registers a `tc-local` GrapesJS storage type.
 *
 * Same backend as the built-in `local` adapter (browser localStorage),
 * but filters out CssRules marked `protected` before serializing. The
 * theme system (`designSystemPlugin`) marks every rule it injects
 * (`:root` token vars, body/element/component style rules) as
 * protected, so this prevents the tenant-wide theme CSS from being
 * duplicated into every per-page project blob.
 *
 * On load, no filtering — the page blob already lacks the theme rules,
 * and `designSystemPlugin.editor.on("load")` re-injects them from
 * `themeStore` after GrapesJS reconstructs the project.
 *
 * Forward-compat: when we replace localStorage with a remote backend
 * for per-page data (the post-MVP storage adapter in the architecture
 * memory), we either swap the delegated `local` to `remote` or
 * introduce a `tc-remote` that delegates the same way. The filtering
 * layer stays orthogonal.
 */

import type { Editor, ProjectData } from "grapesjs"

type StyleEntry = {
  selectors?: unknown
  state?: unknown
  protected?: boolean
  [k: string]: unknown
}

const filterProtectedStyles = (data: ProjectData): ProjectData => {
  // ProjectData is loosely typed; the styles array isn't always present
  // (e.g. on first-ever store of an empty project).
  const styles = (data as { styles?: StyleEntry[] }).styles
  if (!Array.isArray(styles)) return data

  const kept = styles.filter((entry) => entry?.protected !== true)
  if (kept.length === styles.length) return data
  return { ...data, styles: kept }
}

export const tcStorageAdapter = (editor: Editor): void => {
  const getLocal = () => {
    const local = editor.Storage.get("local")
    if (!local) {
      throw new Error(
        "tc-local: built-in `local` storage is unavailable. GrapesJS may have changed how storages are registered."
      )
    }
    return local
  }

  editor.Storage.add("tc-local", {
    async store(data: ProjectData, options) {
      const localOptions = editor.Storage.getStorageOptions("local")
      return getLocal().store(filterProtectedStyles(data), {
        ...localOptions,
        ...options,
      })
    },

    async load(options) {
      const localOptions = editor.Storage.getStorageOptions("local")
      return getLocal().load({ ...localOptions, ...options })
    },
  })
}
