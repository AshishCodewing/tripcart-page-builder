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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

type AcknowledgeDialogOptions = {
  title: string
  description: ReactNode
  /** Label next to the required checkbox the user must tick to proceed. */
  acknowledgeLabel: ReactNode
  /** Label for the confirming action. @default "Delete" */
  confirmText?: string
  /** Label for the dismissing action. @default "Cancel" */
  cancelText?: string
  /** Style the confirm button as destructive. @default true */
  destructive?: boolean
}

type UseAcknowledgeDialogResult = {
  /**
   * Open the dialog and await the user's choice. Resolves `true` only when the
   * user ticks the acknowledgement checkbox AND confirms; `false` on cancel /
   * Escape / outside dismissal. Identity is stable.
   */
  confirm: () => Promise<boolean>
  /** Render this once anywhere in the subtree (it portals itself). */
  dialog: ReactNode
}

/**
 * A confirmation dialog gated by a required "I understand the consequences"
 * checkbox — the WordPress pattern for irreversible/structural deletions (e.g.
 * removing the Post Content block from a template). Promise-based like
 * `useConfirmDialog`, but the confirm button stays disabled until the checkbox
 * is ticked, forcing an explicit acknowledgement.
 */
export function useAcknowledgeDialog({
  title,
  description,
  acknowledgeLabel,
  confirmText = "Delete",
  cancelText = "Cancel",
  destructive = true,
}: AcknowledgeDialogOptions): UseAcknowledgeDialogResult {
  const [open, setOpen] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  // Resolve the pending promise once and reset. Idempotent: the first caller
  // wins; the follow-up onOpenChange(false) from closing is a no-op.
  const settle = useCallback((value: boolean) => {
    setOpen(false)
    setAcknowledged(false)
    resolverRef.current?.(value)
    resolverRef.current = null
  }, [])

  const confirm = useCallback(() => {
    setAcknowledged(false)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const dialog = (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) settle(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <Label className="flex items-start gap-2 text-sm font-normal">
          <Checkbox
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(checked === true)}
            className="mt-0.5"
          />
          {acknowledgeLabel}
        </Label>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={!acknowledged}
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
