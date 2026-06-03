import { useSyncExternalStore } from "react"

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error"

let status: SaveStatus = "idle"

const listeners = new Set<() => void>()

export const saveStatusStore = {
  get: (): SaveStatus => status,
  set(next: SaveStatus): void {
    if (next === status) return
    status = next
    for (const fn of listeners) fn()
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(
    saveStatusStore.subscribe,
    saveStatusStore.get,
    () => "idle" as const
  )
}
