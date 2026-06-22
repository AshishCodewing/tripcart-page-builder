"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import type { RowSelectionState } from "@tanstack/react-table"

import {
  bulkDeleteTemplates,
  customizeDefaultLayout,
  customizeDefaultPart,
  duplicateBuiltinPattern,
  duplicateDefaultPart,
  duplicateTemplate,
} from "@/lib/cms/template-actions"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"

import type { TemplateRow, TemplateRowHandlers } from "./types"

// Owns the row-selection state, the delete/reset confirm dialogs, and every
// row-level action callback (each wraps a transition + server action +
// router.refresh()). Returns stable handler identities so the card grid
// doesn't re-render per row.
export function useTemplateActions(tenantId: string): {
  pending: boolean
  rowSelection: RowSelectionState
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>
  dialog: React.ReactNode
  resetDialog: React.ReactNode
  runDelete: (ids: string[]) => Promise<void>
  handlers: TemplateRowHandlers
} {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const { confirm, dialog } = useConfirmDialog({
    title: "Delete templates?",
    description:
      "This permanently removes the selected templates. Any pages that reference them will render a placeholder until updated.",
    confirmText: "Delete",
    cancelText: "Cancel",
    destructive: true,
  })

  const { confirm: confirmReset, dialog: resetDialog } = useConfirmDialog({
    title: "Reset to default?",
    description:
      "This discards your customizations and reverts to the default.",
    confirmText: "Reset",
    cancelText: "Cancel",
    destructive: true,
  })

  const runDelete = React.useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return
      if (!(await confirm())) return
      startTransition(async () => {
        await bulkDeleteTemplates(ids)
        setRowSelection({})
        router.refresh()
      })
    },
    [confirm, router]
  )

  const runDuplicate = React.useCallback(
    (id: string) => {
      startTransition(async () => {
        await duplicateTemplate(id)
        router.refresh()
      })
    },
    [router]
  )

  // Edit a synthetic default row — materializes the DB row (shadowing the
  // code/hierarchy default) and navigates into the editor (the action
  // redirects). Branches by kind: a PART shadows the reserved chrome slug, a
  // LAYOUT materializes the template-hierarchy type.
  const runCustomize = React.useCallback(
    (tenantId: string | null, slug: string, kind: TemplateRow["kind"]) => {
      if (!tenantId) return
      startTransition(async () => {
        if (kind === "LAYOUT") {
          await customizeDefaultLayout(tenantId, slug)
        } else {
          await customizeDefaultPart(tenantId, slug)
        }
      })
    },
    []
  )

  // Duplicate a built-in (code-defined) pattern into an editable tenant
  // pattern. The action creates a blank row and redirects into the editor with
  // `?seed=<blockId>`, which inserts the built-in block's content on load.
  const runDuplicateBuiltin = React.useCallback(
    (blockId: string) => {
      startTransition(async () => {
        await duplicateBuiltinPattern(tenantId, blockId)
      })
    },
    [tenantId]
  )

  // Duplicate a synthetic default into an independent part (non-reserved
  // slug) — stays on the listing, so refresh to surface the new row.
  const runDuplicateDefault = React.useCallback(
    (tenantId: string | null, slug: string) => {
      if (!tenantId) return
      startTransition(async () => {
        await duplicateDefaultPart(tenantId, slug)
        router.refresh()
      })
    },
    [router]
  )

  // Reset a customized default ("shadow" row) — delete the DB row so the slug
  // falls back to its code/hierarchy default (chrome part reverts to
  // `defaultHeader`/`defaultFooter`; a hierarchy template reverts to its
  // synthetic "Default" placeholder).
  const runReset = React.useCallback(
    async (id: string) => {
      if (!(await confirmReset())) return
      startTransition(async () => {
        await bulkDeleteTemplates([id])
        router.refresh()
      })
    },
    [confirmReset, router]
  )

  const handlers = React.useMemo<TemplateRowHandlers>(
    () => ({
      onDuplicate: runDuplicate,
      onDuplicateBuiltin: runDuplicateBuiltin,
      onCustomize: runCustomize,
      onDuplicateDefault: runDuplicateDefault,
      onReset: runReset,
      onDelete: (id: string) => void runDelete([id]),
    }),
    [
      runDuplicate,
      runDuplicateBuiltin,
      runCustomize,
      runDuplicateDefault,
      runReset,
      runDelete,
    ]
  )

  return {
    pending,
    rowSelection,
    setRowSelection,
    dialog,
    resetDialog,
    runDelete,
    handlers,
  }
}
