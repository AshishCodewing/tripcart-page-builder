"use client"

import {
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastRoot,
  ToastTitle,
  ToastViewport,
  useToastManager,
} from "@/components/ui/toast"

// Renders the live toast list into the viewport. Must sit inside the
// <ToastProvider> mounted in the root layout — that provider is also what
// lets any client component call `useToastManager().add(...)`.
export function Toaster() {
  const { toasts } = useToastManager()
  return (
    // Lift above the editor's fixed sidebars (container z-10, rail z-20)
    // so toasts aren't covered. Overrides the primitive's base `z-10` via
    // tailwind-merge rather than editing the shared component.
    <ToastViewport className="z-50">
      {toasts.map((toast) => (
        <ToastRoot key={toast.id} toast={toast} size="compact">
          <ToastContent>
            {toast.title ? <ToastTitle /> : null}
            {toast.description ? <ToastDescription /> : null}
          </ToastContent>
          <ToastClose />
        </ToastRoot>
      ))}
    </ToastViewport>
  )
}
