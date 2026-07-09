import { createElement } from "react"
import { renderToStaticMarkup, renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  RenderProjectFragment,
  type ProjectDefinition,
} from "@/lib/plugins/react-renderer/project"

const projectWith = (styles: unknown[]): ProjectDefinition =>
  ({
    styles,
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
                  attributes: { class: "hero" },
                  components: [{ type: "textnode", content: "Hello" }],
                },
              ],
            },
          },
        ],
      },
    ],
  }) as ProjectDefinition

const redRule = { selectors: ["a"], style: { color: "red" } }

const fragment = (project: ProjectDefinition) =>
  createElement(RenderProjectFragment, { projectData: project })

// The preview surfaces render fragments inside the Next.js document, where
// React 19 hoists a <style href precedence> into <head>. These tests pin
// that contract: hoisted placement, content-derived href, raw (unescaped)
// CSS, and dedupe of identical CSS.
describe("RenderProjectFragment — hoistable page CSS", () => {
  it("hoists the style into <head> after a lower-precedence theme link", () => {
    const html = renderToString(
      createElement(
        "html",
        null,
        createElement(
          "head",
          null,
          createElement("link", {
            rel: "stylesheet",
            href: "/theme.css",
            precedence: "default",
          })
        ),
        createElement("body", null, fragment(projectWith([redRule])))
      )
    )
    const head = html.slice(0, html.indexOf("<body"))
    const linkAt = head.indexOf('data-precedence="default"')
    const styleAt = head.indexOf('data-precedence="tc-page"')
    expect(linkAt).toBeGreaterThan(-1)
    expect(styleAt).toBeGreaterThan(linkAt)
    expect(head).toContain(".a{color:red;}")
  })

  it("derives the href from the CSS content, so it rotates when rules change", () => {
    const dataHref = (styles: unknown[]) =>
      renderToStaticMarkup(fragment(projectWith(styles))).match(
        /data-href="([^"]+)"/
      )?.[1]

    const red = dataHref([redRule])
    const redAgain = dataHref([redRule])
    const blue = dataHref([{ selectors: ["a"], style: { color: "blue" } }])
    expect(red).toMatch(/^tc-/)
    expect(redAgain).toBe(red)
    expect(blue).not.toBe(red)
  })

  it("dedupes identical CSS rendered by two fragments in one document", () => {
    const html = renderToString(
      createElement(
        "html",
        null,
        createElement(
          "body",
          null,
          fragment(projectWith([redRule])),
          fragment(projectWith([redRule]))
        )
      )
    )
    expect(html.match(/data-precedence="tc-page"/g)).toHaveLength(1)
  })

  it("does not HTML-escape CSS (selectorsAdd combinator stays literal)", () => {
    // Pinned against React 19: string children of a hoistable <style>
    // render raw, same as the dangerouslySetInnerHTML path it replaced.
    const html = renderToStaticMarkup(
      fragment(
        projectWith([
          {
            selectors: ["a"],
            selectorsAdd: ".a > .b",
            style: { color: "red" },
          },
        ])
      )
    )
    expect(html).toContain(".a > .b")
  })

  it("emits no style tag when the project has no rules", () => {
    const html = renderToStaticMarkup(fragment(projectWith([])))
    expect(html).not.toContain("<style")
  })
})
