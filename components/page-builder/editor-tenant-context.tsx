"use client"

import * as React from "react"

// Per-record identity for the editor session, provided by EditorShell.
//
// `tenantId` is which tenant the AI assistant bills; null for global templates
// (admin-internal, deliberately unmetered).
//
// `threadId` is the copilot's conversation id for the record being edited —
// stable across reloads, which is what makes chat history restore. It is
// SIGNED and minted server-side (lib/ai/thread-id.ts); the browser only ever
// receives it as a prop.
type EditorSession = {
  tenantId: string | null
  threadId: string
}

const EditorSessionContext = React.createContext<EditorSession | null>(null)

export function EditorSessionProvider({
  tenantId,
  threadId,
  children,
}: EditorSession & { children: React.ReactNode }) {
  const value = React.useMemo(
    () => ({ tenantId, threadId }),
    [tenantId, threadId]
  )
  return (
    <EditorSessionContext.Provider value={value}>
      {children}
    </EditorSessionContext.Provider>
  )
}

/** Tenant whose wallet the AI assistant bills; null when unmetered. */
export function useEditorTenantId(): string | null {
  return React.useContext(EditorSessionContext)?.tenantId ?? null
}

/** Stable conversation id for the record being edited. */
export function useEditorThreadId(): string {
  const session = React.useContext(EditorSessionContext)
  if (!session) {
    throw new Error(
      "useEditorThreadId must be used inside an EditorSessionProvider"
    )
  }
  return session.threadId
}
