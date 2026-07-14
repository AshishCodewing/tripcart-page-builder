"use client"

import { useEffect } from "react"

// Loads + registers the interactive web components (e.g. <tc-tabs>) on
// preview/published pages, where the content is React-rendered.
//
// Why a client-only dynamic import (not a <script> tag or a static import):
//   - The web-component module evaluates `class extends HTMLElement` at load,
//     which throws in Node — so it must never run during SSR. A dynamic
//     import() inside useEffect only executes in the browser.
//   - useEffect runs AFTER hydration, so the elements enhance the DOM after
//     React has hydrated it (no hydration mismatch).
//   - defineInteractive builds the classes against THIS window's HTMLElement
//     (the realm it runs in). The canvas iframe calls the same defineInteractive
//     with the iframe's window (on `canvas:frame:load`), so one source serves
//     both realms with no build step.
//
// Render this only when the page actually uses an interactive component (see
// usesInteractiveComponents) so pages without one ship zero web-component JS.
export function InteractiveComponentsLoader() {
  useEffect(() => {
    void import("@/lib/web-components").then((m) => m.defineInteractive(window))
  }, [])
  return null
}
