// @vitest-environment jsdom
import grapesjs, { type Editor } from "grapesjs"
import { afterEach, describe, expect, it } from "vitest"

import { tabsPlugin } from "./tabs"

// Regression coverage for tab↔panel pairing on load. Historically each tab
// spawned a fresh placeholder panel because it matched panels by aria-controls
// only; AI-authored markup ships tabs + panels with no ids, so a 3-tab / 3-panel
// import produced 6 panels. `getUnlinkedPanel` now adopts the index-aligned
// panel first.
let editor: Editor | undefined

afterEach(() => {
  editor?.destroy()
  editor = undefined
})

function load(html: string) {
  editor = grapesjs.init({
    headless: true,
    storageManager: false,
    plugins: [tabsPlugin],
  })
  editor.addComponents(html)
  const tabs = editor.getWrapper()!.findType("tc-tabs")[0]!
  const tabEls = tabs.findType("tc-tab")
  const panelEls = tabs.findType("tc-tab-panel")
  return { tabs, tabEls, panelEls }
}

function pairing(tabEls: ReturnType<typeof load>["tabEls"]) {
  return tabEls.map((t) => t.getAttributes()["aria-controls"])
}

describe("tc-tabs plugin — panel pairing", () => {
  it("adopts index-aligned panels for AI-authored markup (no ids) — no duplicates", () => {
    const { tabEls, panelEls } = load(`
      <tc-tabs>
        <div role="tablist">
          <button role="tab"><span>Anna</span></button>
          <button role="tab"><span>Miguel</span></button>
          <button role="tab"><span>Priya</span></button>
        </div>
        <div class="tc-tabs__panels">
          <div role="tabpanel"><blockquote>Effortless.</blockquote></div>
          <div role="tabpanel"><blockquote>Curated.</blockquote></div>
          <div role="tabpanel"><blockquote>Last-minute deal.</blockquote></div>
        </div>
      </tc-tabs>`)

    // The bug: 3 tabs used to spawn 3 extra placeholder panels (→ 6).
    expect(tabEls.length).toBe(3)
    expect(panelEls.length).toBe(3)

    // Each tab links to a distinct panel, index-aligned to the authored content.
    const controls = pairing(tabEls)
    expect(new Set(controls).size).toBe(3)
    controls.forEach((id, i) => expect(panelEls[i].getId()).toBe(id))

    // Adopted panels keep their authored content (not "Tab panel content…").
    expect(panelEls.map((p) => p.getInnerHTML()).join("")).toContain(
      "Effortless."
    )
    expect(panelEls.map((p) => p.getInnerHTML()).join("")).not.toContain(
      "Tab panel content"
    )
  })

  it("honors an explicit aria-controls link (no new panels)", () => {
    const { panelEls } = load(`
      <tc-tabs>
        <div role="tablist">
          <button role="tab" id="t0" aria-controls="p0"><span>One</span></button>
          <button role="tab" id="t1" aria-controls="p1"><span>Two</span></button>
        </div>
        <div class="tc-tabs__panels">
          <div role="tabpanel" id="p0"><p>First</p></div>
          <div role="tabpanel" id="p1"><p>Second</p></div>
        </div>
      </tc-tabs>`)
    expect(panelEls.length).toBe(2)
  })

  it("creates placeholders when panels are missing (fewer than tabs)", () => {
    const { tabEls, panelEls } = load(`
      <tc-tabs>
        <div role="tablist">
          <button role="tab"><span>A</span></button>
          <button role="tab"><span>B</span></button>
          <button role="tab"><span>C</span></button>
        </div>
        <div class="tc-tabs__panels">
          <div role="tabpanel"><p>only one</p></div>
        </div>
      </tc-tabs>`)
    expect(tabEls.length).toBe(3)
    expect(panelEls.length).toBe(3) // 1 adopted + 2 created
    expect(new Set(pairing(tabEls)).size).toBe(3)
  })

  it("default scaffold omits aria-orientation (horizontal is the ARIA default)", () => {
    editor = grapesjs.init({
      headless: true,
      storageManager: false,
      plugins: [tabsPlugin],
    })
    editor.addComponents({ type: "tc-tabs" })
    const list = editor.getWrapper()!.findType("tc-tab-list")[0]!
    expect(list.getAttributes()["aria-orientation"]).toBeUndefined()
    expect(list.getClasses()).not.toContain("tc-tabs__list--vertical")
  })

  it("orientation trait toggles aria-orientation + layout classes", () => {
    editor = grapesjs.init({
      headless: true,
      storageManager: false,
      plugins: [tabsPlugin],
    })
    editor.addComponents({ type: "tc-tabs" })
    const tabs = editor.getWrapper()!.findType("tc-tabs")[0]!
    const list = tabs.findType("tc-tab-list")[0]!

    list.set("orientation", "vertical")
    expect(list.getAttributes()["aria-orientation"]).toBe("vertical")
    expect(list.getClasses()).toContain("tc-tabs__list--vertical")
    expect(tabs.getClasses()).toContain("tc-tabs--vertical")

    list.set("orientation", "horizontal")
    expect(list.getAttributes()["aria-orientation"]).toBeUndefined()
    expect(list.getClasses()).not.toContain("tc-tabs__list--vertical")
    expect(tabs.getClasses()).not.toContain("tc-tabs--vertical")
  })

  it("reflects author-supplied aria-orientation into the trait + classes", () => {
    const { tabs } = load(`
      <tc-tabs>
        <div role="tablist" aria-orientation="vertical">
          <button role="tab"><span>One</span></button>
          <button role="tab"><span>Two</span></button>
        </div>
        <div class="tc-tabs__panels">
          <div role="tabpanel"><p>First</p></div>
          <div role="tabpanel"><p>Second</p></div>
        </div>
      </tc-tabs>`)
    const list = tabs.findType("tc-tab-list")[0]!
    expect(list.get("orientation")).toBe("vertical")
    expect(list.getClasses()).toContain("tc-tabs__list--vertical")
    expect(tabs.getClasses()).toContain("tc-tabs--vertical")
  })

  it("accessible-label trait toggles aria-label, omitting it when empty", () => {
    editor = grapesjs.init({
      headless: true,
      storageManager: false,
      plugins: [tabsPlugin],
    })
    editor.addComponents({ type: "tc-tabs" })
    const list = editor.getWrapper()!.findType("tc-tab-list")[0]!

    expect(list.getAttributes()["aria-label"]).toBeUndefined()

    list.set("ariaLabel", "Customer reviews")
    expect(list.getAttributes()["aria-label"]).toBe("Customer reviews")

    list.set("ariaLabel", "   ")
    expect(list.getAttributes()["aria-label"]).toBeUndefined()
  })

  it("reflects author-supplied aria-label into the trait", () => {
    const { tabs } = load(`
      <tc-tabs>
        <div role="tablist" aria-label="Plans">
          <button role="tab"><span>One</span></button>
          <button role="tab"><span>Two</span></button>
        </div>
        <div class="tc-tabs__panels">
          <div role="tabpanel"><p>First</p></div>
          <div role="tabpanel"><p>Second</p></div>
        </div>
      </tc-tabs>`)
    const list = tabs.findType("tc-tab-list")[0]!
    expect(list.get("ariaLabel")).toBe("Plans")
    expect(list.getAttributes()["aria-label"]).toBe("Plans")
  })

  it("activation trait toggles data-activation, omitting it for automatic", () => {
    editor = grapesjs.init({
      headless: true,
      storageManager: false,
      plugins: [tabsPlugin],
    })
    editor.addComponents({ type: "tc-tabs" })
    const list = editor.getWrapper()!.findType("tc-tab-list")[0]!

    // Automatic is the default — implicit, no attribute.
    expect(list.getAttributes()["data-activation"]).toBeUndefined()

    list.set("activation", "manual")
    expect(list.getAttributes()["data-activation"]).toBe("manual")

    list.set("activation", "automatic")
    expect(list.getAttributes()["data-activation"]).toBeUndefined()
  })

  it("reflects author-supplied data-activation into the trait", () => {
    const { tabs } = load(`
      <tc-tabs>
        <div role="tablist" data-activation="manual">
          <button role="tab"><span>One</span></button>
          <button role="tab"><span>Two</span></button>
        </div>
        <div class="tc-tabs__panels">
          <div role="tabpanel"><p>First</p></div>
          <div role="tabpanel"><p>Second</p></div>
        </div>
      </tc-tabs>`)
    const list = tabs.findType("tc-tab-list")[0]!
    expect(list.get("activation")).toBe("manual")
    expect(list.getAttributes()["data-activation"]).toBe("manual")
  })

  it("open-by-default trait sets aria-selected and clears siblings", () => {
    editor = grapesjs.init({
      headless: true,
      storageManager: false,
      plugins: [tabsPlugin],
    })
    editor.addComponents({ type: "tc-tabs" })
    const tabs = editor.getWrapper()!.findType("tc-tabs")[0]!
    const tabEls = tabs.findType("tc-tab")

    tabEls[1].set("defaultSelected", true)
    expect(tabEls[1].getAttributes()["aria-selected"]).toBe("true")

    // Choosing another default is exclusive — the previous one is cleared.
    tabEls[2].set("defaultSelected", true)
    expect(tabEls[2].getAttributes()["aria-selected"]).toBe("true")
    expect(tabEls[1].getAttributes()["aria-selected"]).toBeUndefined()
    expect(tabEls[1].get("defaultSelected")).toBe(false)

    // Unchecking removes the attribute (runtime falls back to the first tab).
    tabEls[2].set("defaultSelected", false)
    expect(tabEls[2].getAttributes()["aria-selected"]).toBeUndefined()
  })

  it("reflects author-supplied aria-selected into the open-by-default trait", () => {
    const { tabEls } = load(`
      <tc-tabs>
        <div role="tablist">
          <button role="tab"><span>One</span></button>
          <button role="tab" aria-selected="true"><span>Two</span></button>
        </div>
        <div class="tc-tabs__panels">
          <div role="tabpanel"><p>First</p></div>
          <div role="tabpanel"><p>Second</p></div>
        </div>
      </tc-tabs>`)
    expect(tabEls[0].get("defaultSelected")).toBe(false)
    expect(tabEls[1].get("defaultSelected")).toBe(true)
  })

  it("default scaffold (3 tabs, 0 panels) still creates 3 panels", () => {
    editor = grapesjs.init({
      headless: true,
      storageManager: false,
      plugins: [tabsPlugin],
    })
    editor.addComponents({ type: "tc-tabs" })
    const tabs = editor.getWrapper()!.findType("tc-tabs")[0]!
    expect(tabs.findType("tc-tab").length).toBe(3)
    expect(tabs.findType("tc-tab-panel").length).toBe(3)
  })
})
