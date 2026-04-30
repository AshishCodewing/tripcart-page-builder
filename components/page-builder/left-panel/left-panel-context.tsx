"use client"

import * as React from "react"

export type LeftPanelMode = "blocks" | "layers" | "theme"

type LeftPanelState = {
  mode: LeftPanelMode
  open: boolean
}

type LeftPanelContextValue = {
  /** Resolved mode shown in the panel; null when the panel is closed. */
  activeMode: LeftPanelMode | null
  /** Last selected mode, retained while the panel is closed. */
  mode: LeftPanelMode
  open: boolean
  /** Click a tab: same mode while open closes; different mode switches + opens. */
  togglePanel: (mode: LeftPanelMode) => void
  setOpen: (open: boolean) => void
}

const LeftPanelContext = React.createContext<LeftPanelContextValue | null>(null)

type ProviderProps = {
  initialMode?: LeftPanelMode
  initialOpen?: boolean
  children: React.ReactNode
}

export function LeftPanelProvider({
  initialMode = "blocks",
  initialOpen = true,
  children,
}: ProviderProps) {
  const [state, setState] = React.useState<LeftPanelState>({
    mode: initialMode,
    open: initialOpen,
  })

  const togglePanel = React.useCallback((mode: LeftPanelMode) => {
    setState((prev) => {
      if (prev.open && prev.mode === mode) return { ...prev, open: false }
      return { mode, open: true }
    })
  }, [])

  const setOpen = React.useCallback((open: boolean) => {
    setState((prev) => (prev.open === open ? prev : { ...prev, open }))
  }, [])

  const value = React.useMemo<LeftPanelContextValue>(
    () => ({
      activeMode: state.open ? state.mode : null,
      mode: state.mode,
      open: state.open,
      togglePanel,
      setOpen,
    }),
    [state.mode, state.open, togglePanel, setOpen]
  )

  return (
    <LeftPanelContext.Provider value={value}>
      {children}
    </LeftPanelContext.Provider>
  )
}

export function useLeftPanel() {
  const ctx = React.useContext(LeftPanelContext)
  if (!ctx) {
    throw new Error("useLeftPanel must be used within a LeftPanelProvider")
  }
  return ctx
}
