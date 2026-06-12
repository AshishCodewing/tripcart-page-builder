import { createElement, Fragment } from "react"
import type { Editor } from "grapesjs"
import { afterEach, describe, expect, it, vi } from "vitest"

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

// Most element cases process to a single definition object; narrow the union
// (which also covers the Fragment array case) down to that object for asserts.
const processOne = (
  model: unknown,
  config: RendererReactOptions = {},
  editor = makeEditor()
): Record<string, unknown> | undefined => {
  const out = process(model, config, editor)
  return Array.isArray(out) ? undefined : out
}

afterEach(() => {
  vi.restoreAllMocks()
})

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
    const out = processOne(
      createElement("text" as never),
      {},
      makeEditor(["text"])
    )
    expect(out?.type).toBe("text")
    expect(out && "tagName" in out).toBe(false)
  })

  it("resolves a registered React component to its config type", () => {
    const MyHero = () => null
    const out = processOne(createElement(MyHero), {
      components: { MyHero: { component: MyHero } },
    })
    expect(out?.type).toBe("MyHero")
  })

  it("degrades an unregistered function component to a typeless container and warns", () => {
    // An unregistered function component finds no config match, so we omit the
    // `type` key entirely (never type:undefined) and warn naming the component
    // so the silent disappearance is loud. A default container materializes
    // downstream.
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const Unknown = () => null
    const out = processOne(createElement(Unknown))
    expect(out && "type" in out).toBe(false)
    expect(out && "tagName" in out).toBe(false)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]?.[0]).toContain("Unknown")
  })

  it("flattens a Fragment into its children array (transparent container)", () => {
    // Fragments (symbol type) are transparent: they process to a flat array of
    // their children, which splices into the parent's components.
    const out = process(createElement(Fragment, null, createElement("div")))
    expect(out).toEqual([{ tagName: "div" }])
  })

  it("processes an empty Fragment to an empty array", () => {
    expect(process(createElement(Fragment))).toEqual([])
  })

  it("splices a nested Fragment's children into the parent components", () => {
    const out = processOne(
      createElement(
        "div",
        null,
        createElement("span"),
        createElement(Fragment, null, createElement("b"), createElement("i"))
      )
    )
    expect(out?.components).toEqual([
      { tagName: "span" },
      { tagName: "b" },
      { tagName: "i" },
    ])
  })

  it("coerces a single string child into one textnode", () => {
    const out = processOne(createElement("div", null, "hi"))
    expect(out?.components).toEqual([{ type: "textnode", content: "hi" }])
  })

  it("drops non-string, non-element children from a mixed array", () => {
    const inner = createElement("span")
    const out = processOne(createElement("div", null, "a", inner, null, 42))
    expect(out?.components).toEqual([
      { type: "textnode", content: "a" },
      { tagName: "span" },
    ])
  })

  it("returns undefined for a non-element model", () => {
    expect(process("hi")).toBeUndefined()
  })
})
