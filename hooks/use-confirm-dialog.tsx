"use client"

import { useCallback, useRef, useState, type ReactNode } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type ConfirmDialogOptions = {
  title?: string
  description?: ReactNode
  /** Label for the confirming action. @default "Confirm" */
  confirmText?: string
  /** Label for the dismissing action. @default "Cancel" */
  cancelText?: string
  /** Style the confirm button as destructive. @default false */
  destructive?: boolean
}

type UseConfirmDialogResult = {
  /**
   * Open the dialog and await the user's choice. Resolves `true` when the
   * confirm action is taken, `false` on cancel / Escape / outside dismissal.
   * Identity is stable, so it's safe to pass as a dependency or callback.
   */
  confirm: () => Promise<boolean>
  /** Render this once anywhere in the subtree (it portals itself). */
  dialog: ReactNode
}

/**
 * Promise-based confirmation built on the shadcn `AlertDialog`. Bridges the
 * declarative dialog to an imperative `await confirm()` so it can back any
 * "are you sure?" flow — e.g. `useFormGuard({ onBlock: confirm })` for the
 * back/forward guard, or a link's `onNavigate`.
 */
export function useConfirmDialog({
  title = "Are you sure?",
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
}: ConfirmDialogOptions = {}): UseConfirmDialogResult {
  const [open, setOpen] = useState(false)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  // Resolve the pending promise once and close. Idempotent: the first caller
  // wins and clears the resolver, so the follow-up onOpenChange(false) that
  // closing fires is a no-op.
  const settle = useCallback((value: boolean) => {
    setOpen(false)
    resolverRef.current?.(value)
    resolverRef.current = null
  }, [])

  const confirm = useCallback(() => {
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const dialog = (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Escape or any non-button close counts as a cancel.
        if (!next) settle(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            onClick={() => settle(true)}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { confirm, dialog }
}
