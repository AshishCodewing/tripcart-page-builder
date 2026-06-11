import { createElement, Fragment } from "react"
import type { Editor } from "grapesjs"
import { describe, expect, it } from "vitest"

import {
  getComponentConfig,
  isReactElement,
} from "@/lib/plugins/react-renderer/react-element"
import { processReactElements } from "@/lib/plugins/react-renderer/process"
import type { RendererReactOptions } from "@/lib/plugins/react-renderer/types"

const makeEditor = (knownTypes: string[] = []) =>
  ({
    Components: {
      getType: (t: string) => (knownTypes.includes(t) ? { id: t } : undefined),
    },
    Parser: {
      parserHtml: {
        splitPropsFromAttr: (rest: Record<string, unknown>) => ({
          attrs: { ...rest },
          props: {},
        }),
      },
    },
  }) as unknown as Editor

const process = (
  model: unknown,
  config: RendererReactOptions = {},
  editor = makeEditor()
) => processReactElements({ model, editor, config })

describe("isReactElement", () => {
  it("recognizes a createElement result", () => {
    expect(isReactElement(createElement("div"))).toBe(true)
  })

  it("rejects non-elements", () => {
    expect(isReactElement(null)).toBe(false)
    expect(isReactElement("x")).toBe(false)
    expect(isReactElement({})).toBe(false)
    expect(isReactElement({ $$typeof: Symbol("x") })).toBe(false)
  })
})

describe("getComponentConfig", () => {
  const MyHero = () => null
  const config: RendererReactOptions = {
    components: { MyHero: { component: MyHero } },
  }

  it("finds an entry by component identity", () => {
    expect(getComponentConfig(config, MyHero)?.type).toBe("MyHero")
  })

  it("returns undefined for an unregistered component", () => {
    const Other = () => null
    expect(getComponentConfig(config, Other)).toBeUndefined()
  })
})

describe("processReactElements", () => {
  it("converts an intrinsic tag with class, style, id, and a text child", () => {
    const el = createElement(
      "section",
      { className: "hero", style: { backgroundColor: "red" }, id: "x" },
      "Hello"
    )
    expect(process(el)).toEqual({
      tagName: "section",
      classes: "hero",
      style: { "background-color": "red" },
      attributes: { id: "x" },
      components: [{ type: "textnode", content: "Hello" }],
    })
  })

  it("resolves a registered GrapesJS string type to out.type with no tagName", () => {
    const out = process(
      createElement("text" as never),
      {},
      makeEditor(["text"])
    )
    expect(out?.type).toBe("text")
    expect(out && "tagName" in out).toBe(false)
  })

  it("resolves a registered React component to its config type", () => {
    const MyHero = () => null
    const out = process(createElement(MyHero), {
      components: { MyHero: { component: MyHero } },
    })
    expect(out?.type).toBe("MyHero")
  })

  it("(KNOWN QUIRK) degrades an unregistered function component to type:undefined", () => {
    // KNOWN QUIRK: an unregistered function component finds no config match,
    // so out.type is set to undefined and no tagName is assigned. The element
    // silently disappears downstream with no warning. Audited 2026-06-11.
    const Unknown = () => null
    const out = process(createElement(Unknown))
    expect(out && "type" in out && out.type === undefined).toBe(true)
    expect(out && "tagName" in out).toBe(false)
  })

  it("(KNOWN QUIRK) leaves a Fragment with neither type nor tagName but processes children", () => {
    // KNOWN QUIRK: Fragments (symbol type) get neither type nor tagName, so a
    // default <div> materializes downstream — Fragments are NOT transparent.
    // Children are still processed. Audited 2026-06-11.
    const out = process(createElement(Fragment, null, createElement("div")))
    expect(out && "type" in out).toBe(false)
    expect(out && "tagName" in out).toBe(false)
    expect(out?.components).toEqual([{ tagName: "div" }])
  })

  it("coerces a single string child into one textnode", () => {
    const out = process(createElement("div", null, "hi"))
    expect(out?.components).toEqual([{ type: "textnode", content: "hi" }])
  })

  it("drops non-string, non-element children from a mixed array", () => {
    const inner = createElement("span")
    const out = process(createElement("div", null, "a", inner, null, 42))
    expect(out?.components).toEqual([
      { type: "textnode", content: "a" },
      { tagName: "span" },
    ])
  })

  it("returns undefined for a non-element model", () => {
    expect(process("hi")).toBeUndefined()
  })
})
