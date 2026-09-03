// Style surface for `<tc-tabs>` — the parts a theme may restyle. Pure data:
// the theme compiler imports it server-side, so no GrapesJS here.
//
// Selectors mirror tabs.ts's structural CSS (custom element + ARIA roles,
// never author-chosen classes) but carry real specificity, so a theme
// declaration beats the plugin's `:where()` defaults. Note the cascade
// consequence: a theme `color` on the tab part also recolors the selected
// tab unless the theme sets the `[aria-selected="true"]` state too.
//
// Layout groups are deliberately absent from `supports`: display, flex
// direction and the vertical-orientation classes are the plugin's, and a
// theme changing them would break the tabs behaviour.

import type { StyleSurface } from "@/lib/theme/style-surfaces"

export const tabsStyleSurface: StyleSurface = {
  type: "tc-tabs",
  label: "Tabs",
  root: {
    label: "Tabs container",
    selector: "tc-tabs",
    supports: ["color", "spacing", "border", "shadow"],
    states: [],
  },
  parts: {
    list: {
      label: "Tab bar",
      selector: 'tc-tabs [role="tablist"]',
      supports: ["color", "spacing", "border"],
      states: [],
    },
    tab: {
      label: "Tab button",
      selector: 'tc-tabs [role="tab"]',
      supports: ["color", "typography", "spacing", "border"],
      states: [":hover", ":focus-visible", '[aria-selected="true"]'],
    },
    panel: {
      label: "Tab panel",
      selector: 'tc-tabs [role="tabpanel"]',
      supports: ["color", "typography", "spacing", "border"],
      states: [],
    },
  },
}
