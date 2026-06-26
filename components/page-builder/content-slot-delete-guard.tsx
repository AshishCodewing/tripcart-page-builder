"use client"

import { useEditorMaybe } from "@grapesjs/react"
import { useEffect, useRef } from "react"
import type { Component, RemoveOptions } from "grapesjs"

import { CONTENT_SLOT_TYPE } from "@/lib/plugins/post-fields"
import { useAcknowledgeDialog } from "@/hooks/use-acknowledge-dialog"

/**
 * Pass `{ [SKIP_SLOT_GUARD]: true }` to `component.remove(opts)` to bypass the
 * acknowledgement prompt for intentional, non-destructive internal removals
 * (e.g. convert-to-template swapping the original for a `template-ref`).
 */
export const SKIP_SLOT_GUARD = "skipContentSlotGuard"

/** Whether removing `cmp` would take a content slot with it (itself or nested). */
function containsContentSlot(cmp: Component): boolean {
  return (
    cmp.get("type") === CONTENT_SLOT_TYPE ||
    // `tc-content-slot` is the slot's `isComponent` marker class (post-fields.ts).
    cmp.find(".tc-content-slot").length > 0
  )
}

/**
 * Cascades the "Delete content block?" acknowledgement to ANY deletion whose
 * subtree contains the content slot — not just deleting the slot directly.
 *
 * Removing the slot blanks every post using the template, so it must never go
 * silently. `removable: false` blocks deleting the bare slot, but does nothing
 * when an ancestor is deleted (the whole subtree goes with it). We intercept at
 * the single choke point every delete path funnels through — GrapesJS'
 * `component:remove:before` (keyboard `core:component-delete`, the toolbar trash,
 * any programmatic `.remove()`): abort the removal, run the dialog, then call the
 * captured continuation on confirm.
 *
 * The check runs on the component being removed (self + descendants) because
 * cascade child-removals do NOT fire their own `component:remove:before`.
 */
export function ContentSlotDeleteGuard() {
  const editor = useEditorMaybe()
  // The deferred removal handed to us by `component:remove:before`; calling it
  // completes the delete WITHOUT re-firing the event (it's the inner closure).
  const pendingRemove = useRef<(() => void) | null>(null)

  const { confirm, dialog } = useAcknowledgeDialog({
    title: "Delete content block?",
    description: (
      <>
        This removes the block that displays the content of posts using this
        template.{" "}
        <strong className="font-semibold text-foreground">
          Posts using this template will not display any content.
        </strong>{" "}
        Visitors will see blank pages.
      </>
    ),
    acknowledgeLabel: "I understand the consequences",
    confirmText: "Delete",
  })

  useEffect(() => {
    if (!editor) return

    const onRemoveBefore = (
      cmp: Component,
      removeFn: () => void,
      opts: RemoveOptions
    ) => {
      // `abort` / our skip flag aren't on the public RemoveOptions type, but the
      // engine reads `opts.abort` to defer removal (grapes.min.js).
      const o = opts as RemoveOptions & {
        abort?: boolean
        [SKIP_SLOT_GUARD]?: boolean
      }
      if (o[SKIP_SLOT_GUARD]) return
      // A prompt is already pending (e.g. multi-select keyboard delete). Don't
      // stack dialogs — abort the extra removal rather than queue it.
      if (pendingRemove.current) {
        o.abort = true
        return
      }
      if (!containsContentSlot(cmp)) return

      o.abort = true
      pendingRemove.current = removeFn
      confirm().then((ok) => {
        const fn = pendingRemove.current
        pendingRemove.current = null
        if (ok && fn) fn()
      })
    }

    editor.on("component:remove:before", onRemoveBefore)
    return () => {
      editor.off("component:remove:before", onRemoveBefore)
    }
  }, [editor, confirm])

  return dialog
}
