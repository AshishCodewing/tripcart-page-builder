// Server-rendered initial state for tc-tabs: the active tab + hidden panels
// must be present in the markup so there's no flash before the client-side
// web component enhances (lib/web-components/tabs.ts loads post-hydration).
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ComponentNode } from "@/lib/plugins/react-renderer/project/models"
import { RenderComponent } from "@/lib/plugins/react-renderer/project/render-component"
import type { ComponentDefinition } from "@/lib/plugins/react-renderer/project/types"

const tab = (label: string, selected = false): ComponentDefinition => ({
  type: "tc-tab",
  tagName: "button",
  classes: ["tc-tabs__tab"],
  attributes: { role: "tab", ...(selected ? { "aria-selected": "true" } : {}) },
  components: [{ type: "textnode", content: label }],
})

const panel = (text: string): ComponentDefinition => ({
  type: "tc-tab-panel",
  tagName: "div",
  classes: ["tc-tabs__panel"],
  attributes: { role: "tabpanel" },
  components: [{ type: "textnode", content: text }],
})

const tabs = (defaultIndex: number | null): ComponentDefinition => ({
  type: "tc-tabs",
  tagName: "tc-tabs",
  components: [
    {
      type: "tc-tab-list",
      tagName: "div",
      attributes: { role: "tablist" },
      components: [
        tab("One", defaultIndex === 0),
        tab("Two", defaultIndex === 1),
        tab("Three", defaultIndex === 2),
      ],
    },
    {
      type: "tc-tab-panels",
      tagName: "div",
      classes: ["tc-tabs__panels"],
      components: [panel("First"), panel("Second"), panel("Third")],
    },
  ],
})

const render = (def: ComponentDefinition) =>
  renderToStaticMarkup(
    createElement(RenderComponent, { component: new ComponentNode(def) })
  )

// Opening tag (attributes) of the element whose text content is `text`.
const openTag = (html: string, text: string) =>
  html.match(new RegExp(`<[a-z-]+([^>]*)>${text}<`))?.[1] ?? ""

describe("tc-tabs server-rendered initial state", () => {
  it("open-by-default tab: only that panel is visible, that tab is active", () => {
    const html = render(tabs(1)) // "Two" / "Second" is default

    // Active tab carries the active class + aria-selected.
    expect(openTag(html, "Two")).toContain("tc-tabs__tab--active")
    expect(openTag(html, "Two")).toContain('aria-selected="true"')
    expect(openTag(html, "One")).not.toContain("tc-tabs__tab--active")
    expect(openTag(html, "One")).toContain('aria-selected="false"')

    // Non-default panels are hidden server-side; the default one is not.
    expect(openTag(html, "First")).toContain("hidden")
    expect(openTag(html, "Second")).not.toContain("hidden")
    expect(openTag(html, "Third")).toContain("hidden")
  })

  it("no default: falls back to the first tab", () => {
    const html = render(tabs(null))

    expect(openTag(html, "One")).toContain("tc-tabs__tab--active")
    expect(openTag(html, "One")).toContain('aria-selected="true"')
    expect(openTag(html, "First")).not.toContain("hidden")
    expect(openTag(html, "Second")).toContain("hidden")
    expect(openTag(html, "Third")).toContain("hidden")
  })
})
