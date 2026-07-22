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
  __syncDefaultSelected(): void
  getTabsType(): TabsCmp | undefined
  getTabContent(): Component | undefined
  getUnlinkedPanel(): Component | undefined
}
type TabsCmp = Cmp & {
  __onTab(tab: Component, v?: unknown, opts?: { avoidStore?: boolean; temporary?: boolean }): void
  getListType(): Component | undefined
  getPanelsType(): Component
  findTabs(): Component[]
  findPanels(): Component[]
  addTab(content?: unknown): void
}
type ListCmp = Cmp & {
  __syncOrientation(): void
  __syncLabel(): void
  __syncActivation(): void
}

// Structural defaults. Selectors target the custom element + stable ARIA
// roles/attributes — NEVER author-chosen class names, which the AI or a user
// may replace. Cosmetic rules sit in :where() so they carry ZERO specificity
// and any author / Style-Manager rule overrides them trivially. The panel-hide
// rule is intentionally NOT in :where (real specificity) so a stray author
// display rule can't accidentally reveal an inactive panel.
const tabsCss = `
:where(tc-tabs) { display: block; }

:where(tc-tabs [role="tablist"]) {
  display: flex;
  flex-wrap: wrap;
  gap: var(--size-2, 0.5rem);
  border-bottom: 1px solid
    var(--tc--preset--color--border, color-mix(in oklch, currentColor 14%, transparent));
  margin-bottom: var(--size-3, 1rem);
}

:where(tc-tabs [role="tab"]) {
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

:where(tc-tabs [role="tab"]:hover) {
  color: var(--tc--preset--color--foreground, currentColor);
}

:where(tc-tabs [role="tab"][aria-selected="true"]) {
  color: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
  border-bottom-color: var(--tc--preset--color--primary, hsl(var(--indigo-6-hsl)));
}

tc-tabs [role="tabpanel"][hidden] { display: none; }

/* Vertical orientation (aria-orientation="vertical"). Flat single-token
   selectors only — see feedback_grapesjs_flat_selectors. The wrapper +
   list get modifier classes in sync with the trait; .tc-tabs__panels'
   flex is inert while the wrapper is display:block (horizontal). */
.tc-tabs--vertical {
  display: flex;
  align-items: flex-start;
  gap: var(--size-4, 1.5rem);
}

.tc-tabs__list--vertical {
  flex-direction: column;
  flex-wrap: nowrap;
  border-right: 1px solid
    var(--tc--preset--color--border, color-mix(in oklch, currentColor 14%, transparent));
  border-bottom: 0;
  margin-right: var(--size-3, 1rem);
  margin-bottom: 0;
}

.tc-tabs__panels { flex: 1 1 auto; min-width: 0; }
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
        // Which tab opens first. Mirrored to aria-selected="true" (the ARIA
        // default the runtime reads, lib/web-components/tabs.ts #wire); exactly
        // one tab may be the default, so setting it clears the siblings.
        defaultSelected: false,
        traits: [
          {
            type: "checkbox",
            name: "defaultSelected",
            label: "Open by default",
            changeProp: true,
          },
        ],
      },

      init(this: TabCmp) {
        this.on("removed", this.__onRemove)
        // Reflect author/AI-supplied aria-selected into the trait, then keep the
        // attribute in sync (radio-group: only one default across the tablist).
        if (this.getAttributes()["aria-selected"] === "true") {
          this.set("defaultSelected", true)
        }
        this.on("change:defaultSelected", this.__syncDefaultSelected)
      },

      __syncDefaultSelected(this: TabCmp) {
        if (!this.get("defaultSelected")) {
          this.removeAttributes("aria-selected")
          return
        }
        this.addAttributes({ "aria-selected": "true" })
        // Clear every sibling — silent prop write avoids re-triggering this
        // handler, and we drop their attribute directly.
        this.getTabsType()
          ?.findTabs()
          .forEach((sib) => {
            if (sib === this) return
            sib.set("defaultSelected", false, { silent: true })
            sib.removeAttributes("aria-selected")
          })
      },

      // Pair this tab with a panel and wire the id link. Reuse the panel this
      // tab already links to, else (for AI-authored markup, which ships tabs +
      // panels with NO ids — the codegen contract forbids them, see
      // lib/plugins/interactive/tags.ts) adopt the panel at this tab's index
      // rather than spawning a duplicate placeholder. Only create a fresh panel
      // when neither yields one. Mirrors the runtime enhancer's aria-controls-
      // then-index matching (lib/web-components/tabs.ts #panelFor).
      __initTab(this: TabCmp) {
        if (this.tabContent) return
        const tabs = this.getTabsType()
        if (!tabs) return
        let content = this.getTabContent() ?? this.getUnlinkedPanel()
        if (!content) {
          content = tabs.getPanelsType().append({
            type: T_PANEL,
            components: "<p>Tab panel content…</p>",
          })[0]
        }
        // getTabContent() only returns a panel this tab already links to; for
        // an adopted or freshly created panel the link is still missing, so wire
        // it. (Guarding on aria-controls avoids re-stamping an existing link.)
        if (!this.getAttributes()[ARIA_CONTROLS]) {
          const panelId = content.getId()
          const tabId = this.getId()
          content.addAttributes({ id: panelId, "aria-labelledby": tabId })
          this.addAttributes({ [ARIA_CONTROLS]: panelId, id: tabId })
        }
        this.tabContent = content
      },

      // The panel at this tab's index, when it isn't already claimed by another
      // tab's aria-controls. Lets index-aligned tabs↔panels (e.g. imported
      // markup with no ids) pair up without creating duplicate panels; the
      // claimed check keeps a mid-list clone from stealing a sibling's panel.
      getUnlinkedPanel(this: TabCmp) {
        const tabs = this.getTabsType()
        if (!tabs) return undefined
        const panel = tabs.findPanels()[tabs.findTabs().indexOf(this)]
        if (!panel) return undefined
        const claimed = new Set(
          tabs
            .findTabs()
            .map((t) => t.getAttributes()[ARIA_CONTROLS])
            .filter(Boolean)
        )
        return claimed.has(panel.getId()) ? undefined : panel
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

      // A cloned tab must get its OWN fresh panel, not point at the original's,
      // and must not inherit the "open by default" flag (only one default per
      // tablist).
      clone(this: TabCmp, ...args: unknown[]) {
        const cloned = (
          defaultModel.prototype as unknown as {
            clone: (...a: unknown[]) => TabCmp
          }
        ).clone.apply(this, args)
        cloned.addAttributes({ [ARIA_CONTROLS]: "" })
        cloned.set("defaultSelected", false, { silent: true })
        cloned.removeAttributes("aria-selected")
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
        // Bound to a prop (not the attribute) so horizontal — the ARIA
        // default — can stay implicit: we emit aria-orientation only for
        // vertical. The runtime enhancer reads it for Up/Down key nav
        // (lib/web-components/tabs.ts onKeydown).
        orientation: "horizontal",
        // Accessible name for the tablist (APG: a tablist should have one).
        // Prop-bound + synced so an empty value omits aria-label rather than
        // emitting aria-label="".
        ariaLabel: "",
        // APG activation model. Automatic (default) — moving focus activates —
        // stays implicit (no attribute); manual emits data-activation="manual",
        // which the runtime enhancer reads (lib/web-components/tabs.ts onKeydown)
        // to require Enter/Space after arrow navigation.
        activation: "automatic",
        traits: [
          {
            type: "button",
            name: "add-tab",
            label: false,
            text: "+ Add tab",
            full: true,
            command: ADD_TAB_CMD,
          },
          {
            type: "text",
            name: "ariaLabel",
            label: "Accessible label",
            placeholder: "e.g. Customer reviews",
            changeProp: true,
          },
          {
            type: "select",
            name: "orientation",
            label: "Orientation",
            changeProp: true,
            options: [
              { id: "horizontal", label: "Horizontal" },
              { id: "vertical", label: "Vertical" },
            ],
          },
          {
            type: "select",
            name: "activation",
            label: "Activation",
            changeProp: true,
            options: [
              { id: "automatic", label: "Automatic" },
              { id: "manual", label: "Manual" },
            ],
          },
        ],
      },

      init(this: ListCmp) {
        // Reflect any author/AI-supplied attributes into the traits so the
        // Settings panel + layout classes match the markup, then keep the
        // attributes in sync with the traits.
        const attrs = this.getAttributes()
        if (attrs["aria-orientation"] === "vertical") {
          this.set("orientation", "vertical")
        }
        if (attrs["aria-label"]) this.set("ariaLabel", attrs["aria-label"])
        if (attrs["data-activation"] === "manual") {
          this.set("activation", "manual")
        }
        this.on("change:orientation", this.__syncOrientation)
        this.on("change:ariaLabel", this.__syncLabel)
        this.on("change:activation", this.__syncActivation)
        this.__syncOrientation()
      },

      __syncLabel(this: ListCmp) {
        const label = String(this.get("ariaLabel") ?? "").trim()
        if (label) this.addAttributes({ "aria-label": label })
        else this.removeAttributes("aria-label")
      },

      __syncActivation(this: ListCmp) {
        // Automatic is the default, so keep it implicit (no attribute).
        if (this.get("activation") === "manual") {
          this.addAttributes({ "data-activation": "manual" })
        } else {
          this.removeAttributes("data-activation")
        }
      },

      __syncOrientation(this: ListCmp) {
        const vertical = this.get("orientation") === "vertical"
        if (vertical) this.addAttributes({ "aria-orientation": "vertical" })
        else this.removeAttributes("aria-orientation")
        if (vertical) this.addClass("tc-tabs__list--vertical")
        else this.removeClass("tc-tabs__list--vertical")
        const tabs = this.closestType(T_TABS)
        if (!tabs) return
        if (vertical) tabs.addClass("tc-tabs--vertical")
        else tabs.removeClass("tc-tabs--vertical")
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
