/**
 * GrapesJS storage for editor content.
 *
 * Persistence lives in Postgres: the `tc-remote` storage type (see
 * `tcRemoteStorage` below) autosaves the project to the record's
 * `draftData` column via a server action, and the editor seeds its
 * initial canvas from the server-rendered `draftData ?? data` through
 * the `projectData` init option. localStorage is no longer used for
 * per-record content — this replaces the previous `tc-local` adapter.
 *
 * Both the autosave path and the publish path (`augmentedSave` in
 * EditorShell → save{Page,Post,Template}) drop CssRules marked
 * `protected` before serializing via `filterProtectedStyles`. The theme
 * system (`designSystemPlugin`) marks every rule it injects (`:root`
 * token vars, body/element/component defaults) as protected and
 * re-injects them on `editor.on("load")`, so keeping them out of saved
 * blobs leaves the tenant theme as the single source of truth.
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

/**
 * Factory for the `tc-remote` GrapesJS storage type — autosaves the
 * project to Postgres (the `draftData` column) instead of localStorage.
 *
 * Closes over a `persistDraft` callback (a bound `saveEditorDraft` server
 * action) and the server-rendered initial project. EditorShell builds the
 * callback per record and debounces it, and passes the same project it
 * feeds to the `projectData` init option.
 *
 * On `store` we drop protected theme rules first (`filterProtectedStyles`)
 * — same discipline as the old `tc-local` adapter — so the tenant theme
 * stays the single source of truth and isn't baked into every draft blob.
 *
 * On `load` we return the server-rendered `initialProject`
 * (`draftData ?? data`). In practice the `projectData` init option already
 * seeds the canvas and makes GrapesJS skip the initial storage load, so
 * this is the safety net for any explicit `editor.load()` / `Storage.load()`
 * — it returns the real project instead of wiping the canvas to empty.
 */
export const tcRemoteStorage =
  (
    persistDraft: (data: ProjectData) => Promise<void>,
    initialProject: ProjectData
  ) =>
  (editor: Editor): void => {
    editor.Storage.add("tc-remote", {
      async load() {
        return initialProject
      },

      async store(data: ProjectData) {
        await persistDraft(filterProtectedStyles(data))
      },
    })
  }
