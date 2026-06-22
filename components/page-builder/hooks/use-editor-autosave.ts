"use client"

import * as React from "react"
import type { ProjectData } from "grapesjs"

import { useToastManager } from "@/components/ui/toast"

type EditorAutosave = {
  // Trailing-debounced autosave handed to the storage adapter. Resolves
  // immediately so GrapesJS isn't blocked on the network; the write is
  // fire-and-forget ~1s after the last change.
  debouncedPersist: (data: ProjectData) => Promise<void>
  // Drop a queued debounce + its captured payload — called before an explicit
  // Save/Publish so a stale draft can't fire after the server clears it.
  cancelPendingDraft: () => void
}

// Owns the autosave debounce around `persistDraft`. GrapesJS' `store` may fire
// several times during a burst of edits; we collapse them into one DB write
// ~1s after the last change. Debounce state lives in refs so the returned
// callbacks keep a stable identity across renders.
export function useEditorAutosave(
  persistDraft: (data: ProjectData) => Promise<void>
): EditorAutosave {
  // Keep the latest bound `persistDraft` in a ref so the debouncer's identity
  // stays stable while always calling the current action.
  const persistDraftRef = React.useRef(persistDraft)
  React.useEffect(() => {
    persistDraftRef.current = persistDraft
  }, [persistDraft])

  // Toast manager kept in a ref so the stable-identity callbacks below can
  // fire toasts without re-binding on every render.
  const toast = useToastManager()
  const toastRef = React.useRef(toast)
  React.useEffect(() => {
    toastRef.current = toast
  }, [toast])

  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const pendingDraftRef = React.useRef<ProjectData | null>(null)

  const debouncedPersist = React.useCallback(
    (data: ProjectData): Promise<void> => {
      pendingDraftRef.current = data
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null
        const payload = pendingDraftRef.current
        pendingDraftRef.current = null
        if (payload) {
          // Background draft autosave stays silent on success — it's a
          // crash-recovery net, not a user action. A failure is the only
          // thing worth interrupting for: the latest edits may be lost on
          // reload, so surface it as a toast.
          void persistDraftRef.current(payload).catch((err) => {
            console.error("[gjs] draft autosave failed", err)
            toastRef.current.add({
              type: "destructive",
              title: "Autosave failed",
              description:
                "We couldn't save your draft. Recent edits may be lost if you reload — try Save draft.",
            })
          })
        }
      }, 1000)
      return Promise.resolve()
    },
    []
  )

  // An explicit Save/Publish posts the freshest getProjectData() itself and
  // the server clears `draftData` — a debounce queued before the click is
  // stale by definition and, if allowed to fire after the commit, would
  // resurrect `draftData` and leave the editor claiming to be "ahead" of
  // what it just published. Drop both the timer and the captured payload.
  const cancelPendingDraft = React.useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    pendingDraftRef.current = null
  }, [])

  // Flush a pending debounced draft on unmount / record switch so the last
  // <1s of edits isn't silently dropped when navigating away before the timer
  // fires. (Publish is unaffected — it posts fresh getProjectData() directly.)
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      const payload = pendingDraftRef.current
      pendingDraftRef.current = null
      if (payload) {
        void persistDraftRef
          .current(payload)
          .catch((err) => console.error("[gjs] draft flush failed", err))
      }
    }
  }, [])

  return { debouncedPersist, cancelPendingDraft }
}
