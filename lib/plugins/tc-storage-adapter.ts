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

/**
 * Drop every CssRule marked `protected: true` from a `ProjectData`
 * blob. Used everywhere data leaves the editor for persistence: the
 * tc-local storage adapter (localStorage autosaves), the publish
 * flow in editor-shell (Postgres writes), and the preview renderer
 * (defensive — strips any protected rules legacy publishes baked
 * into the DB before this filter was applied on the publish path).
 *
 * Theme rules — `:root` token vars and the body/element/component
 * defaults — are the protected category. Keeping them out of saved
 * project data means the tenant theme is the single source of truth
 * across surfaces, and a tenant-side theme change shows up everywhere
 * on next render without needing to re-publish every page.
 */
export const filterProtectedStyles = (data: ProjectData): ProjectData => {
  // ProjectData is loosely typed; the styles array isn't always present
  // (e.g. on first-ever store of an empty project).
  const styles = (data as { styles?: StyleEntry[] }).styles
  if (!Array.isArray(styles)) return data

  const kept = styles.filter((entry) => entry?.protected !== true)
  if (kept.length === styles.length) return data
  return { ...data, styles: kept }
}

/**
 * Collect serialized page-scoped CSS rules from the live editor, dropping
 * any rule marked `protected` (theme rules from `designSystemPlugin`).
 * Mirrors `filterProtectedStyles` but reads the CssRules collection
 * directly instead of building a full `getProjectData()` shape just to
 * dig out `.styles`. Use when the caller only needs styles (e.g. the
 * convert-to-template dialog snapshotting CSS for the new template).
 */
export const getPageStyles = (editor: Editor): StyleEntry[] => {
  return editor.Css.getRules()
    .filter((rule) => rule.get("protected") !== true)
    .map((rule) => rule.toJSON() as StyleEntry)
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
