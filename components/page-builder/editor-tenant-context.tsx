"use client"

import * as React from "react"

// Which tenant the editor session belongs to, for AI billing. Provided by
// EditorShell from `contentTenantId(content)`; null for global templates
// (admin-internal, deliberately unmetered).
const EditorTenantContext = React.createContext<string | null>(null)

export function EditorTenantProvider({
  tenantId,
  children,
}: {
  tenantId: string | null
  children: React.ReactNode
}) {
  return (
    <EditorTenantContext.Provider value={tenantId}>
      {children}
    </EditorTenantContext.Provider>
  )
}

/** Tenant whose wallet the AI assistant bills; null when unmetered. */
export function useEditorTenantId(): string | null {
  return React.useContext(EditorTenantContext)
}
