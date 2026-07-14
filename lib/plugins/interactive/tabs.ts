// Tabs authoring plugin — the GrapesJS editing layer for the `<tc-tabs>`
// light-DOM web component (lib/web-components/tabs.ts). Everything the author
// edits is a real component (WYSIWYG, like grapesjs-tabs); the web component
// only wires runtime behavior + a11y over this structure.
//
//   tc-tabs
//   ├── tc-tab-list        (role=tablist)   — "Add Tab" trait
//   │   ├── tc-tab          (role=tab, editable label)
//   ├── tc-tab-panels      (panels wrapper, locked)
//   │   ├── tc-tab-panel    (role=tabpanel, editable content)
//
// Tab↔panel are linked by id (tab.aria-controls === panel.id). The model logic
// (create/remove/clone the paired panel) is ported from
// node_modules/grapesjs-tabs/src/components/{Tab,Tabs}.js — we keep its proven
// algorithm but drop its per-instance `script` (our web component handles
// runtime) and use tc-* names + theme vars.

import type { Component, Editor } from "grapesjs"

import { defineInteractive } from "@/lib/web-components"

const T_TABS = "tc-tabs"
const T_LIST = "tc-tab-list"
const T_TAB = "tc-tab"
const T_PANELS = "tc-tab-panels"
const T_PANEL = "tc-tab-panel"
const ADD_TAB_CMD = "tc-tabs:add-tab"
const ARIA_CONTROLS = "aria-controls"

// Minimal typing for the ported Backbone-style model methods (`this` is the
// Component model). grapesjs' Component carries the Backbone Model API
// (on/listenTo/trigger) plus GrapesJS helpers used below.
type Cmp = Component & {
  listenTo: (obj: unknown, ev: string, cb: (...a: unknown[]) => void) => void
  trigger: (ev: string) => void
}
type TabCmp = Cmp & {
  tabContent?: Component
  __initTab(): void
  __onRemove(): void
  getTabsType(): TabsCmp | undefined
  getTabContent(): Component | undefined
}
type TabsCmp = Cmp & {
  __onTab(tab: Component, v?: unknown, opts?: { avoidStore?: boolean; temporary?: boolean }): void
  getListType(): Component | undefined
  getPanelsType(): Component
  findTabs(): Component[]
  findPanels(): Component[]
  addTab(content?: unknown): void
}

const tabsCss = `
tc-tabs { display: block; }

.tc-tabs__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--size-2, 0.5rem);
  border-bottom: 1px solid
    var(--tc--preset--color--border, color-mix(in oklch, currentColor 14%, transparent));
  margin-bottom: var(--size-3, 1rem);
}

.tc-tabs__tab {
  appearance: none;
  border: 0;
  background: transparent;
  padding: var(--size-2, 0.5rem) var(--size-3, 0.875rem);
  font: inherit;
  font-family: var(--tc--preset--font-family--body, var(--font-sans));
  color: color-mix(in oklch, var(--tc--preset--color--foreground, currentColor) 66%, transparent);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
}

.tc-tabs__tab:hover { color: var(--tc--preset--color--foreground, currentColor); }

.tc-tabs__tab--active {
  color: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
  border-bottom-color: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
}

.tc-tabs__panel[hidden] { display: none; }
`

const tabsMedia = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M22 9.3c0-.8-.5-1.3-1.3-1.3H3.4C2.5 8 2 8.5 2 9.3v7.4c0 .8.5 1.3 1.3 1.3h17.4c.8 0 1.3-.5 1.3-1.3V9.3zM21 17H3V9h18v8z" fill-rule="nonzero"/><rect x="3" y="5" width="4" height="2" rx=".5"/><rect x="8" y="5" width="4" height="2" rx=".5"/><rect x="13" y="5" width="4" height="2" rx=".5"/>
</svg>
`

export const tabsPlugin = (editor: Editor): void => {
  const dc = editor.Components
  const defaultModel = dc.getType("default")!.model

  // ── tc-tab (role=tab) — editable label; owns its paired panel ───────────
  dc.addType(T_TAB, {
    isComponent: (el) =>
      el.tagName?.toLowerCase() === "button" && el.getAttribute?.("role") === "tab",
    model: {
      defaults: {
        name: "Tab",
        tagName: "button",
        draggable: `[data-gjs-type=${T_LIST}]`,
        // Label lives in an inner text component (like grapesjs-tabs' span) so
        // GrapesJS inline RTE works — a custom `editable` type does NOT get the
        // text view. Only text may be dropped in.
        droppable: false,
        removable: true,
        copyable: true,
        attributes: { role: "tab", type: "button" },
        classes: ["tc-tabs__tab"],
        components: "<span>Tab</span>",
      },

      init(this: TabCmp) {
        this.on("removed", this.__onRemove)
      },

      // Create the paired panel if it doesn't exist yet, and wire the id link.
      __initTab(this: TabCmp) {
        if (this.tabContent) return
        let content = this.getTabContent()
        if (!content) {
          const tabs = this.getTabsType()
          if (!tabs) return
          content = tabs.getPanelsType().append({
            type: T_PANEL,
            components: "<p>Tab panel content…</p>",
          })[0]
          const panelId = content.getId()
          const tabId = this.getId()
          content.addAttributes({ id: panelId, "aria-labelledby": tabId })
          this.addAttributes({ [ARIA_CONTROLS]: panelId, id: tabId })
        }
        this.tabContent = content
      },

      __onRemove(this: TabCmp) {
        this.getTabContent()?.remove()
      },

      getTabsType(this: TabCmp) {
        return this.closestType(T_TABS) as TabsCmp | undefined
      },

      getTabContent(this: TabCmp) {
        const id = this.getAttributes()[ARIA_CONTROLS]
        const tabs = this.getTabsType()
        if (!tabs || !id) return undefined
        return tabs.findPanels().filter((c) => c.getId() === id)[0]
      },

      // A cloned tab must get its OWN fresh panel, not point at the original's.
      clone(this: TabCmp, ...args: unknown[]) {
        const cloned = (
          defaultModel.prototype as unknown as {
            clone: (...a: unknown[]) => TabCmp
          }
        ).clone.apply(this, args)
        cloned.addAttributes({ [ARIA_CONTROLS]: "" })
        return cloned
      },
    },
  })

  // ── tc-tab-list (role=tablist) ──────────────────────────────────────────
  dc.addType(T_LIST, {
    isComponent: (el) => el.getAttribute?.("role") === "tablist",
    model: {
      defaults: {
        name: "Tab List",
        tagName: "div",
        attributes: { role: "tablist" },
        classes: ["tc-tabs__list"],
        droppable: `[data-gjs-type=${T_TAB}]`,
        draggable: false,
        removable: false,
        copyable: false,
        traits: [
          {
            type: "button",
            name: "add-tab",
            label: false,
            text: "+ Add tab",
            full: true,
            command: ADD_TAB_CMD,
          },
        ],
      },
    },
  })

  // ── tc-tab-panel (role=tabpanel) ────────────────────────────────────────
  dc.addType(T_PANEL, {
    isComponent: (el) => el.getAttribute?.("role") === "tabpanel",
    model: {
      defaults: {
        name: "Tab Panel",
        tagName: "div",
        attributes: { role: "tabpanel" },
        classes: ["tc-tabs__panel"],
        droppable: true,
        draggable: false,
        copyable: false,
        removable: false, // removed together with its tab
      },
    },
  })

  // ── tc-tab-panels (panels wrapper) ──────────────────────────────────────
  dc.addType(T_PANELS, {
    isComponent: (el) =>
      el instanceof HTMLElement && el.classList?.contains("tc-tabs__panels"),
    model: {
      defaults: {
        name: "Tab Panels",
        tagName: "div",
        classes: ["tc-tabs__panels"],
        draggable: false,
        droppable: `[data-gjs-type=${T_PANEL}]`,
        copyable: false,
        removable: false,
      },
    },
  })

  // ── tc-tabs (wrapper) ───────────────────────────────────────────────────
  dc.addType(T_TABS, {
    isComponent: (el) => el.tagName?.toLowerCase() === "tc-tabs",
    model: {
      defaults: {
        name: "Tabs",
        tagName: "tc-tabs",
        droppable: false,
        draggable: true,
        removable: true,
        copyable: true,
        styles: tabsCss,
        components: [
          {
            type: T_LIST,
            components: [
              { type: T_TAB, components: "<span>Tab 1</span>" },
              { type: T_TAB, components: "<span>Tab 2</span>" },
              { type: T_TAB, components: "<span>Tab 3</span>" },
            ],
          },
          { type: T_PANELS },
        ],
      },

      init(this: TabsCmp) {
        this.findTabs().forEach((t) => this.__onTab(t))
        const list = this.getListType()
        if (list) this.listenTo(list.components(), "add", this.__onTab)
      },

      __onTab(this: TabsCmp, tab: Component, _v?: unknown, opts: { avoidStore?: boolean; temporary?: boolean } = {}) {
        const t = tab as TabCmp
        if (!opts.avoidStore && !opts.temporary && t.__initTab) t.__initTab()
      },

      getListType(this: TabsCmp) {
        return this.findType(T_LIST)[0]
      },

      getPanelsType(this: TabsCmp) {
        return this.findType(T_PANELS)[0] || this
      },

      findTabs(this: TabsCmp) {
        return this.findType(T_TAB)
      },

      findPanels(this: TabsCmp) {
        return this.findType(T_PANEL)
      },

      addTab(this: TabsCmp, content?: unknown) {
        const list = this.getListType()
        list?.append({ type: T_TAB, components: content ?? "<span>New tab</span>" })
      },
    },
    view: {
      // Non-persisted: puts the web component into edit mode (single panel,
      // click-to-switch, no focus side-effects). Preview toggles it off.
      onRender({ el }) {
        if (!el.hasAttribute("editing")) el.setAttribute("editing", "")
      },
    },
  })

  editor.Commands.add(ADD_TAB_CMD, {
    run(ed) {
      const sel = ed.getSelected() as TabsCmp | undefined
      if (!sel) return
      const tabs = (sel.is(T_TABS) ? sel : sel.closestType(T_TABS)) as TabsCmp | undefined
      tabs?.addTab()
    },
  })

  editor.Blocks.add(T_TABS, {
    label: "Tabs",
    category: "Interactive",
    media: tabsMedia,
    content: { type: T_TABS },
    activate: true,
    resetId: true,
  })

  // Register the web components INTO the canvas iframe's realm on each frame
  // load (custom elements are realm-bound). No build step / `canvas.scripts` —
  // the same source is imported and defined against the iframe's HTMLElement.
  editor.on("canvas:frame:load", ({ window }) => defineInteractive(window))

  // Preview: strip/restore `editing` so the web component switches from edit
  // mode to live behavior. Command events are `command:run`/`command:stop`.
  const setEditing = (on: boolean) => {
    const doc = editor.Canvas.getDocument?.()
    doc?.querySelectorAll("tc-tabs").forEach((el) => {
      if (on) el.setAttribute("editing", "")
      else el.removeAttribute("editing")
    })
  }
  editor.on("command:run:core:preview", () => setEditing(false))
  editor.on("command:stop:core:preview", () => setEditing(true))
}
