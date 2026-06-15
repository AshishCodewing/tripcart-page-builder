import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import RenderProject from "@/lib/plugins/react-renderer/project/render-project"
import type { RenderProjectProps } from "@/lib/plugins/react-renderer/project/types"

const render = (props: RenderProjectProps) =>
  renderToStaticMarkup(createElement(RenderProject, props))

const project = {
  styles: [{ selectors: ["a"], style: { color: "red" } }],
  pages: [
    {
      id: "home",
      frames: [
        {
          component: {
            type: "wrapper",
            components: [
              {
                tagName: "section",
                attributes: { id: "s1", class: "hero" },
                components: [{ type: "textnode", content: "Hello" }],
              },
            ],
          },
        },
      ],
    },
  ],
}

describe("RenderProject — happy path", () => {
  it("renders the section, its text, and the project CSS in a <style>", () => {
    const html = render({ projectData: project })
    expect(html).toContain("<section")
    expect(html).toContain('class="hero"')
    expect(html).toContain('id="s1"')
    expect(html).toContain("Hello")
    expect(html).toContain("<style>")
    expect(html).toContain(".a{color:red;}")
  })

  it("does not HTML-escape CSS inside <style> (selectorsAdd combinator stays literal)", () => {
    // Pinned against React 19 (2026-06-11): text children of <style> render raw.
    const html = render({
      projectData: {
        styles: [
          {
            selectors: ["a"],
            selectorsAdd: ".a > .b",
            style: { color: "red" },
          },
        ],
        pages: project.pages,
      },
    })
    expect(html).toContain(".a > .b")
  })
})

describe("RenderProject — error paths", () => {
  it("reports noPagesFound for an empty project", () => {
    expect(render({ projectData: {} })).toContain("Error: noPagesFound")
  })

  it("reports pageNotFound for an unknown pageId", () => {
    expect(render({ projectData: project, pageId: "nope" })).toContain(
      "Error: pageNotFound"
    )
  })

  it("reports noFramesFound for a page with no frames", () => {
    expect(
      render({ projectData: { pages: [{ id: "p", frames: [] }] } })
    ).toContain("Error: noFramesFound")
  })

  it("reports componentNotFound for an unknown componentId", () => {
    expect(render({ projectData: project, componentId: "nope" })).toContain(
      "Error: componentNotFound"
    )
  })
})

describe("RenderProject — componentId subtree", () => {
  it("renders just the targeted subtree without an <html> document", () => {
    const html = render({ projectData: project, componentId: "s1" })
    expect(html).toContain("<section")
    expect(html).toContain("Hello")
    expect(html).not.toContain("<html")
  })
})

describe("RenderProject — registered React component", () => {
  const PriceTag = (props: { zip?: unknown; children?: ReactNode }) =>
    createElement("span", null, `${typeof props.zip}:${String(props.zip)}`)

  const withPriceTag = (zip: string) => ({
    pages: [
      {
        id: "home",
        frames: [
          {
            component: {
              type: "wrapper",
              components: [{ type: "price-tag", attributes: { zip } }],
            },
          },
        ],
      },
    ],
  })

  it("leaves a numeric-looking string with a leading zero as a string (lossless)", () => {
    // Coercion is round-trip-safe: "01234" does not satisfy
    // String(Number(v)) === v, so it stays a string — the leading zero
    // survives.
    const html = render({
      projectData: withPriceTag("01234"),
      config: { components: { "price-tag": { component: PriceTag } } },
    })
    expect(html).toContain("string:01234")
  })

  it("coerces a clean integer string to a number", () => {
    const html = render({
      projectData: withPriceTag("123"),
      config: { components: { "price-tag": { component: PriceTag } } },
    })
    expect(html).toContain("number:123")
  })

  it("leaves a non-numeric string prop as a string", () => {
    const html = render({
      projectData: withPriceTag("ab1"),
      config: { components: { "price-tag": { component: PriceTag } } },
    })
    expect(html).toContain("string:ab1")
  })
})

describe("RenderProject — void + escaping", () => {
  it("renders an image node as a void <img> with no children", () => {
    const html = render({
      projectData: {
        pages: [
          {
            id: "home",
            frames: [
              {
                component: {
                  type: "wrapper",
                  components: [
                    {
                      type: "image",
                      attributes: { src: "/x.png" },
                      components: [{ type: "textnode", content: "ignored" }],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    })
    expect(html).toContain("<img")
    expect(html).not.toContain("ignored")
  })

  it("escapes stored HTML in textnode content (not interpreted as markup)", () => {
    const html = render({
      projectData: {
        pages: [
          {
            id: "home",
            frames: [
              {
                component: {
                  type: "wrapper",
                  components: [
                    {
                      tagName: "div",
                      components: [{ type: "textnode", content: "<b>x</b>" }],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    })
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;")
  })
})
