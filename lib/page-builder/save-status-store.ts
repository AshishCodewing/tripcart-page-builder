import { useSyncExternalStore } from "react"

// Shared `dirty` flag bridging the canvas (EditorShell) to the chrome
// (TopBarRight). `dirty` means there are canvas edits since the last
// *commit* (Save/Publish) — it is what makes the primary action mean
// something: when the record is PUBLISHED and `dirty` is true the live
// page is behind the editor, so the button reads "Update".
//
// `dirty` is NOT cleared by the background draft autosave — only by an
// explicit commit (or when the editor mounts a fresh record). Commit
// pending state comes from `useFormStatus()`; autosave outcomes are
// surfaced via toast (see EditorShell). Neither needs to live here.

let dirty = false

const listeners = new Set<() => void>()

function set(next: boolean): void {
  if (next === dirty) return
  dirty = next
  for (const fn of listeners) fn()
}

export const editorSaveStore = {
  get: (): boolean => dirty,
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  /** A canvas edit landed — the editor is ahead of the last commit. */
  markDirty(): void {
    set(true)
  },
  /**
   * A commit (Save/Publish) succeeded, or the editor mounted on a fresh
   * record. The committed state is now in sync with `data`, so reset.
   */
  committed(): void {
    set(false)
  },
}

export function useIsDirty(): boolean {
  return useSyncExternalStore(
    editorSaveStore.subscribe,
    editorSaveStore.get,
    () => false
  )
}
