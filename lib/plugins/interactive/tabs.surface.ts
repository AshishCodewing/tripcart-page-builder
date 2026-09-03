// Style surface for `<tc-tabs>` — the parts a theme may restyle. Pure data:
// the theme compiler imports it server-side, so no GrapesJS here.
//
// Selectors mirror tabs.ts's structural CSS (custom element + ARIA roles,
// never author-chosen classes) but carry real specificity, so a theme
// declaration beats the plugin's `:where()` defaults. Note the cascade
// consequence: a theme `color` on the tab part also recolors the selected
// tab unless the theme sets the `[aria-selected="true"]` state too.
//
// No part narrows `supports`: every style group is valid CSS on every one of
// these elements, and a tenant restyling their tabs shouldn't hit a different
// set of controls per part. `supports` stays available for a part where a group
// would genuinely break the block.

import type { StyleSurface } from "@/lib/theme/style-surfaces"

export const tabsStyleSurface: StyleSurface = {
  type: "tc-tabs",
  label: "Tabs",
  root: {
    label: "Tabs container",
    selector: "tc-tabs",
    states: [],
  },
  parts: {
    list: {
      label: "Tab bar",
      selector: 'tc-tabs [role="tablist"]',
      states: [],
    },
    tab: {
      label: "Tab button",
      selector: 'tc-tabs [role="tab"]',
      states: [":hover", ":focus-visible", '[aria-selected="true"]'],
    },
    panel: {
      label: "Tab panel",
      selector: 'tc-tabs [role="tabpanel"]',
      states: [],
    },
  },
}
