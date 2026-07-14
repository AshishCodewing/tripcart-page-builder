// Registers the interactive light-DOM web components into a given window realm.
//
// Called with the app `window` on preview/published pages (by
// components/page-builder/interactive-components-loader.tsx) and with the
// canvas iframe's window in the editor (by lib/plugins/interactive/tabs.ts on
// `canvas:frame:load`). The same source serves both — no build step — because
// the classes are built per-realm via factories (see base.ts / tabs.ts).
//
// Safe to import on the server: nothing here touches HTMLElement until
// `defineInteractive` runs (which only happens client-side).

import type { Win } from "./base"
import { tcTabs } from "./tabs"

// Accepts a plain `Window` (that's how GrapesJS types the canvas frame window);
// a real runtime window carries the global constructors the factory needs.
export function defineInteractive(win: Window) {
  const w = win as Win
  if (!w.customElements.get("tc-tabs")) {
    w.customElements.define("tc-tabs", tcTabs(w))
  }
}
