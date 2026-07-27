// Client-only: a cosmetic live-preview overlay rendered inside the GrapesJS
// canvas iframe while a full-page generation streams. It is plain DOM appended
// outside the component model — invisible to GrapesJS (so the empty-page guard
// in applyGenerated still holds) and removed before the real components land.
import type { Editor } from "grapesjs"

const PREVIEW_ID = "tc-ai-stream-preview"

function previewEl(editor: Editor, create: boolean): HTMLElement | null {
  const body = editor.Canvas.getBody()
  if (!body) return null
  const doc = body.ownerDocument
  let el = doc.getElementById(PREVIEW_ID)
  if (!el && create) {
    el = doc.createElement("div")
    el.id = PREVIEW_ID
    // Non-interactive: the preview is a picture, not editable content.
    el.style.pointerEvents = "none"
    body.appendChild(el)
  }
  return el
}

/** Replaces the overlay's contents with the (partial) generated markup.
 * innerHTML is tolerant of unclosed tags, so each throttled tick renders a
 * progressively larger tree; inline <style> tags apply within the iframe. */
export function renderPreview(editor: Editor, html: string): void {
  const el = previewEl(editor, true)
  if (el) el.innerHTML = html
}

/** Removes the overlay. Safe to call when none exists (e.g. error before any
 * delta arrived). Must run before applyGenerated commits the real tree. */
export function clearPreview(editor: Editor): void {
  previewEl(editor, false)?.remove()
}
