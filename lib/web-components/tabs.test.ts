// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest"

import { defineInteractive } from "./index"

beforeAll(() => {
  defineInteractive(window)
})

// The element ENHANCES existing role-based markup (it does not generate it).
function mount(
  opts: { editing?: boolean; linked?: boolean; manual?: boolean } = {}
): HTMLElement {
  const editing = opts.editing ? " editing" : ""
  const activation = opts.manual ? ' data-activation="manual"' : ""
  // `linked` pre-wires aria-controls in a non-default (reversed) order to prove
  // the element honors the id link rather than pairing by index.
  const tabAttrs = (i: number) =>
    opts.linked ? ` id="t${i}" aria-controls="p${i}"` : ""
  const panelAttrs = (i: number) => (opts.linked ? ` id="p${i}"` : "")
  document.body.innerHTML = `
    <tc-tabs${editing}>
      <div role="tablist"${activation}>
        <button role="tab"${tabAttrs(0)}>One</button>
        <button role="tab"${tabAttrs(1)}>Two</button>
        <button role="tab"${tabAttrs(2)}>Three</button>
      </div>
      <div class="tc-tabs__panels">
        <div role="tabpanel"${panelAttrs(0)}>First</div>
        <div role="tabpanel"${panelAttrs(1)}>Second</div>
        <div role="tabpanel"${panelAttrs(2)}>Third</div>
      </div>
    </tc-tabs>`
  return document.querySelector("tc-tabs") as HTMLElement
}

const tabs = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
const panels = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLElement>('[role="tabpanel"]'))
const visible = (el: HTMLElement) => panels(el).filter((p) => !p.hidden)
const tick = () => new Promise((r) => setTimeout(r, 0))

describe("<tc-tabs> self-heal + wiring", () => {
  it("wires ids + ARIA on existing tabs/panels when absent", () => {
    const el = mount()
    tabs(el).forEach((tab, i) => {
      const panel = panels(el)[i]
      expect(tab.id).toBeTruthy()
      expect(tab.getAttribute("aria-controls")).toBe(panel.id)
      expect(panel.getAttribute("aria-labelledby")).toBe(tab.id)
      expect(panel.tabIndex).toBe(0)
    })
  })

  it("does not create a tablist (enhancer, not generator)", () => {
    const el = mount()
    expect(el.querySelectorAll('[role="tablist"]')).toHaveLength(1)
    // exactly the authored tabs/panels — nothing added
    expect(tabs(el)).toHaveLength(3)
    expect(panels(el)).toHaveLength(3)
  })

  it("shows one panel (the first) and hides the rest", () => {
    const el = mount()
    expect(tabs(el)[0].getAttribute("aria-selected")).toBe("true")
    expect(visible(el)).toHaveLength(1)
    expect(visible(el)[0].textContent).toBe("First")
  })
})

describe("<tc-tabs> switching", () => {
  it("click switches to that tab's panel", () => {
    const el = mount()
    tabs(el)[1].dispatchEvent(new MouseEvent("click", { bubbles: true }))
    expect(visible(el)).toHaveLength(1)
    expect(visible(el)[0].textContent).toBe("Second")
    expect(tabs(el)[1].getAttribute("aria-selected")).toBe("true")
    expect(tabs(el)[0].getAttribute("aria-selected")).toBe("false")
  })

  it("honors an existing aria-controls link over index order", () => {
    const el = mount({ linked: true })
    // Reversed link: tab0→p0 ... already index-aligned here; assert link used.
    const t0 = tabs(el)[0]
    const linkedPanel = el.querySelector(`#${t0.getAttribute("aria-controls")}`)
    expect(linkedPanel).toBeTruthy()
    tabs(el)[2].dispatchEvent(new MouseEvent("click", { bubbles: true }))
    expect(visible(el)[0].id).toBe(tabs(el)[2].getAttribute("aria-controls"))
  })

  it("live mode: roving tabindex + arrow-key nav", () => {
    const el = mount()
    expect(tabs(el)[0].tabIndex).toBe(0)
    expect(tabs(el)[1].tabIndex).toBe(-1)
    el.querySelector('[role="tablist"]')!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    )
    expect(tabs(el)[1].getAttribute("aria-selected")).toBe("true")
  })
})

describe("<tc-tabs> keyboard (APG)", () => {
  it("Home/End jump to first/last tab", () => {
    const el = mount()
    const list = el.querySelector('[role="tablist"]')!
    list.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true })
    )
    expect(tabs(el)[2].getAttribute("aria-selected")).toBe("true")
    list.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true })
    )
    expect(tabs(el)[0].getAttribute("aria-selected")).toBe("true")
  })

  it("vertical tablist navigates with Up/Down, ignores Left/Right", () => {
    const el = mount()
    const list = el.querySelector('[role="tablist"]')!
    list.setAttribute("aria-orientation", "vertical")
    list.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    )
    // Horizontal keys do nothing in a vertical tablist.
    expect(tabs(el)[0].getAttribute("aria-selected")).toBe("true")
    list.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    )
    expect(tabs(el)[1].getAttribute("aria-selected")).toBe("true")
    list.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
    )
    expect(tabs(el)[0].getAttribute("aria-selected")).toBe("true")
  })
})

describe("<tc-tabs> manual activation (APG)", () => {
  const key = (list: Element, k: string) =>
    list.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }))

  it("arrow moves focus + roving tabindex but does NOT activate", () => {
    const el = mount({ manual: true })
    const list = el.querySelector('[role="tablist"]')!
    key(list, "ArrowRight")
    // Focus/tabindex moved to tab 1…
    expect(tabs(el)[1].tabIndex).toBe(0)
    expect(tabs(el)[0].tabIndex).toBe(-1)
    expect(document.activeElement).toBe(tabs(el)[1])
    // …but selection stays on tab 0.
    expect(tabs(el)[0].getAttribute("aria-selected")).toBe("true")
    expect(tabs(el)[1].getAttribute("aria-selected")).toBe("false")
    expect(visible(el)[0].textContent).toBe("First")
  })

  it("Enter activates the focused tab", () => {
    const el = mount({ manual: true })
    const list = el.querySelector('[role="tablist"]')!
    key(list, "ArrowRight")
    key(list, "Enter")
    expect(tabs(el)[1].getAttribute("aria-selected")).toBe("true")
    expect(visible(el)).toHaveLength(1)
    expect(visible(el)[0].textContent).toBe("Second")
  })

  it("Space activates the focused tab", () => {
    const el = mount({ manual: true })
    const list = el.querySelector('[role="tablist"]')!
    key(list, "End") // focus last, no activation
    expect(tabs(el)[0].getAttribute("aria-selected")).toBe("true")
    key(list, " ")
    expect(tabs(el)[2].getAttribute("aria-selected")).toBe("true")
    expect(visible(el)[0].textContent).toBe("Third")
  })
})

describe("<tc-tabs> editing mode", () => {
  it("still shows one panel and switches on click", () => {
    const el = mount({ editing: true })
    expect(visible(el)).toHaveLength(1)
    tabs(el)[2].dispatchEvent(new MouseEvent("click", { bubbles: true }))
    expect(visible(el)[0].textContent).toBe("Third")
  })

  it("disables roving tabindex and arrow-key switching", () => {
    const el = mount({ editing: true })
    expect(tabs(el)[0].hasAttribute("tabindex")).toBe(false)
    el.querySelector('[role="tablist"]')!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    )
    // No switch: first tab still active
    expect(tabs(el)[0].getAttribute("aria-selected")).toBe("true")
  })
})

describe("<tc-tabs> reactivity", () => {
  it("re-syncs when a tab+panel pair is appended", async () => {
    const el = mount()
    const tab = document.createElement("button")
    tab.setAttribute("role", "tab")
    tab.textContent = "Four"
    el.querySelector('[role="tablist"]')!.appendChild(tab)
    const panel = document.createElement("div")
    panel.setAttribute("role", "tabpanel")
    panel.textContent = "Fourth"
    el.querySelector(".tc-tabs__panels")!.appendChild(panel)
    await tick()
    expect(tabs(el)).toHaveLength(4)
    expect(tab.getAttribute("aria-controls")).toBe(panel.id)
  })
})
