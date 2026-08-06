// Editor-only canvas chrome: the selection / hover outlines drawn over
// authored content inside the GrapesJS frame.
//
// This string is passed as the top-level `canvasCss` editor option. GrapesJS
// appends it to the <style> it injects into the frame body, AFTER its own
// defaults (`.gjs-selected { outline: 2px solid #3b97e3 !important }`), so a
// same-specificity `!important` rule here wins on source order. `canvasCss`
// never reaches the CssComposer, so none of this is stored in the draft or
// published — no protected-rule bookkeeping needed.
//
// Why we restyle GrapesJS' status classes instead of rendering a custom
// `select` canvas spot: the `gjs-selected` class does double duty. When a
// selector state is active, StyleManager.select() injects a
// `.gjs-selected { <state styles> !important }` rule so the Hover / Focused
// state renders live on the selected node. Declaring
// `customSpots: { select: true }` stops GrapesJS from applying the class at
// all (ComponentView.updateStatus gates on `hasCustomSpot('select')`) and
// would silently break that preview. The `hover` spot has no such double
// duty, so its built-in rendering — the `.gjs-highlighter` overlay plus the
// blue name badge — is switched off via `customSpots` in build-options.ts,
// and the `gjs-hovered` class it still applies is styled here instead.
export const CANVAS_CHROME_CSS = `
:root {
  /* Mirrors --primary and violet-600 from app/globals.css so the outlines
     agree with <FloatingToolbar /> and <FloatingBadge />. Hardcoded because
     the frame is a separate document that never loads the app's Tailwind
     theme; light and dark --primary differ only in lightness (.631 vs .575),
     which is imperceptible at outline scale. */
  --tc-chrome-accent: oklch(0.631 0.2 257.6);
  --tc-chrome-accent-template: oklch(0.541 0.281 293.009);
}

.gjs-hovered {
  outline: 1px solid color-mix(in oklch, var(--tc-chrome-accent) 60%, transparent) !important;
  outline-offset: -1px;
}

.gjs-selected {
  outline: 2px solid var(--tc-chrome-accent) !important;
  outline-offset: -2px;
}

/* Ancestor of the current selection. GrapesJS' default is a solid amber
   border; a dashed tint of the accent reads as subordinate to the selection
   itself. */
.gjs-selected-parent {
  outline: 1px dashed color-mix(in oklch, var(--tc-chrome-accent) 45%, transparent) !important;
  outline-offset: -1px;
}

/* Synced template refs carry the violet accent the floating toolbar and badge
   already use for them. Compound selector (0-2-0) beats the rules above. */
.tc-template-ref.gjs-hovered,
.tc-template-ref.gjs-selected,
.tc-template-ref.gjs-selected-parent {
  outline-color: var(--tc-chrome-accent-template) !important;
}
`
