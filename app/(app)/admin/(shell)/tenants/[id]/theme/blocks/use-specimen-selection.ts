"use client"

import * as React from "react"
import type { Editor } from "grapesjs"

import {
  SELECTED_ATTR,
  SELECTED_PART_ATTR,
  SPECIMEN_ATTR,
} from "@/lib/theme/style-book"

export type SpecimenHighlight = {
  /** Specimen to outline. */
  specimenId: string
  /**
   * For a component part, the selector its theme rule targets — the very
   * elements an edit will change get their own outline inside the specimen.
   * Absent for an element target or a component's root, where the specimen
   * outline already says it all.
   */
  partSelector?: string
}

/**
 * Outlines the specimen the panel is editing — and, for a component part, the
 * elements inside it that the part's selector matches — and lets a click in
 * the canvas pick a specimen.
 *
 * Selection is ours rather than GrapesJS's because what the panel edits is a
 * theme rule, not a component: the Fill and Outline buttons are two blocks of
 * the theme behind one component type, and the specimens are deliberately
 * locked out of component selection (see StyleBookEditor).
 */
export const useSpecimenSelection = (
  editor: Editor | null,
  highlight: SpecimenHighlight | null,
  onSelect: (specimenId: string) => void
): void => {
  const onSelectRef = React.useRef(onSelect)
  React.useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  React.useEffect(() => {
    if (!editor) return

    const attach = (): (() => void) | undefined => {
      const doc = editor.Canvas.getDocument()
      if (!doc) return undefined
      const onClick = (event: Event): void => {
        const el = event.target
        if (!(el instanceof Element)) return
        const id = el.closest(`[${SPECIMEN_ATTR}]`)?.getAttribute(SPECIMEN_ATTR)
        if (id) onSelectRef.current(id)
      }
      doc.addEventListener("click", onClick, true)
      return () => doc.removeEventListener("click", onClick, true)
    }

    let detach = attach()
    const onFrameLoad = (): void => {
      detach?.()
      detach = attach()
    }
    editor.on("canvas:frame:load", onFrameLoad)

    return () => {
      detach?.()
      editor.off("canvas:frame:load", onFrameLoad)
    }
  }, [editor])

  const specimenId = highlight?.specimenId ?? null
  const partSelector = highlight?.partSelector ?? null

  React.useEffect(() => {
    const doc = editor?.Canvas.getDocument()
    if (!doc) return
    for (const el of doc.querySelectorAll(`[${SELECTED_PART_ATTR}]`)) {
      el.removeAttribute(SELECTED_PART_ATTR)
    }
    let next: Element | null = null
    for (const el of doc.querySelectorAll(`[${SPECIMEN_ATTR}]`)) {
      el.removeAttribute(SELECTED_ATTR)
      if (el.getAttribute(SPECIMEN_ATTR) === specimenId) next = el
    }
    if (!next) return
    next.setAttribute(SELECTED_ATTR, "")
    if (!partSelector) return
    // The part's selector is written for the page (`tc-tabs [role="tab"]`),
    // so it resolves inside the specimen exactly as the theme rule will.
    for (const el of next.querySelectorAll(partSelector)) {
      el.setAttribute(SELECTED_PART_ATTR, "")
    }
  }, [editor, specimenId, partSelector])
}
