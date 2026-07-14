// `<tc-tabs>` — light-DOM tabs following the W3C ARIA APG "Tabs with Automatic
// Activation" pattern, built as a realm factory (see base.ts).
//
// ENHANCER (à la knadh/oat): the author's markup already contains the real
// structure — a `role="tablist"` of `role="tab"` buttons plus `role="tabpanel"`
// panels — and this element only wires it at runtime: self-heals ids/ARIA,
// links tabs↔panels, shows one panel at a time, handles click + keyboard. It
// creates no elements. In the builder the GrapesJS type sets an `editing`
// attribute which keeps click-to-switch but disables focus side-effects.

import { tcBase, type Win } from "./base"

export function tcTabs(win: Win) {
  const TcBase = tcBase(win)

  return class TcTabs extends TcBase {
    static get observedAttributes() {
      return ["editing"]
    }

    #tabs: HTMLElement[] = []
    #panels: HTMLElement[] = []
    #tablist: HTMLElement | null = null
    #active = 0
    #observer: MutationObserver | null = null
    #buildQueued = false

    protected init() {
      this.#build()
      this.#observer = new win.MutationObserver((m) => this.#onMutations(m))
      this.#startObserving()
    }

    protected cleanup() {
      this.#observer?.disconnect()
      this.#observer = null
    }

    attributeChangedCallback() {
      if (this.#observer) this.#scheduleBuild()
    }

    #startObserving() {
      this.#observer?.observe(this, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-selected"],
      })
    }

    #onMutations(mutations: MutationRecord[]) {
      const relevant = mutations.some(
        (m) =>
          (m.type === "childList" &&
            (m.target === this.#tablist ||
              (m.target as HTMLElement)?.getAttribute?.("role") === "tablist" ||
              Array.from(m.addedNodes).some(isTabOrPanel) ||
              Array.from(m.removedNodes).some(isTabOrPanel))) ||
          (m.type === "attributes" && m.attributeName === "aria-selected")
      )
      if (relevant) this.#scheduleBuild()
    }

    #scheduleBuild() {
      if (this.#buildQueued) return
      this.#buildQueued = true
      win.queueMicrotask(() => {
        this.#buildQueued = false
        this.#build()
      })
    }

    #build() {
      this.#observer?.disconnect()
      try {
        this.#wire()
      } finally {
        this.#startObserving()
      }
    }

    #wire() {
      this.#tablist = this.querySelector<HTMLElement>('[role="tablist"]')
      this.#tabs = this.#tablist
        ? Array.from(this.#tablist.querySelectorAll<HTMLElement>('[role="tab"]'))
        : []
      this.#panels = Array.from(
        this.querySelectorAll<HTMLElement>('[role="tabpanel"]')
      )
      if (this.#tabs.length === 0 || this.#panels.length === 0) return

      this.#tabs.forEach((tab, i) => {
        const panel = this.#panelFor(tab, i)
        if (!panel) return
        const tabId = tab.id || `tc-tab-${this.uid()}`
        const panelId = panel.id || `tc-panel-${this.uid()}`
        tab.id = tabId
        panel.id = panelId
        tab.setAttribute("aria-controls", panelId)
        panel.setAttribute("aria-labelledby", tabId)
        panel.setAttribute("role", "tabpanel")
        panel.tabIndex = 0
      })

      const preset = this.#tabs.findIndex(
        (t) => t.getAttribute("aria-selected") === "true"
      )
      this.#active = Math.min(preset >= 0 ? preset : 0, this.#tabs.length - 1)
      this.#activate(this.#active)

      this.#tablist!.addEventListener("click", this)
      this.#tablist!.addEventListener("keydown", this)
    }

    #panelFor(tab: HTMLElement, index: number): HTMLElement | undefined {
      const controls = tab.getAttribute("aria-controls")
      if (controls) {
        const byId = this.#panels.find((p) => p.id === controls)
        if (byId) return byId
      }
      return this.#panels[index]
    }

    #activate(idx: number) {
      this.#active = idx
      const editing = this.isEditing
      this.#tabs.forEach((tab, i) => {
        const selected = i === idx
        tab.setAttribute("aria-selected", String(selected))
        tab.classList.toggle("tc-tabs__tab--active", selected)
        if (editing) tab.removeAttribute("tabindex")
        else tab.tabIndex = selected ? 0 : -1
      })
      this.#tabs.forEach((tab, i) => {
        const panel = this.#panelFor(tab, i)
        if (panel) panel.hidden = i !== idx
      })
      this.emit("tc-tab-change", { index: idx })
    }

    onClick(event: MouseEvent) {
      const tab = (event.target as HTMLElement | null)?.closest('[role="tab"]')
      if (!tab) return
      const idx = this.#tabs.indexOf(tab as HTMLElement)
      if (idx >= 0) this.#activate(idx)
    }

    onKeydown(event: KeyboardEvent) {
      if (this.isEditing) return
      const next = this.keyNav(
        event,
        this.#active,
        this.#tabs.length,
        "ArrowLeft",
        "ArrowRight"
      )
      if (next < 0) return
      this.#activate(next)
      this.#tabs[next].focus()
    }
  }
}

function isTabOrPanel(node: Node): boolean {
  // Realm-agnostic: `instanceof HTMLElement` would be false for iframe nodes.
  if (node.nodeType !== 1 /* ELEMENT_NODE */) return false
  const role = (node as Element).getAttribute?.("role")
  return role === "tab" || role === "tabpanel"
}
