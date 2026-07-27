import { describe, expect, it, vi } from "vitest"
import type { Property, PropertyProps } from "grapesjs"

import { splitTransformLayers, transformProp } from "./transform-prop"

const typeProp = (transformProp.properties as PropertyProps[]).find(
  (p) => p.property === "transform-type"
)!

describe("splitTransformLayers", () => {
  it("splits on top-level whitespace", () => {
    expect(splitTransformLayers("translateY(-2px) rotate(3deg)")).toEqual([
      "translateY(-2px)",
      "rotate(3deg)",
    ])
  })

  it("keeps whitespace inside parens with the function", () => {
    expect(
      splitTransformLayers("scale(var(--trip-card-image-scale, 1))")
    ).toEqual(["scale(var(--trip-card-image-scale, 1))"])
    expect(splitTransformLayers("translate(-50%, -50%)")).toEqual([
      "translate(-50%, -50%)",
    ])
  })

  it("drops keyword values that aren't function layers", () => {
    expect(splitTransformLayers("none")).toEqual([])
    expect(splitTransformLayers("")).toEqual([])
  })
})

describe("transform-type onChange", () => {
  // A layer whose function isn't in the option list makes `getOption()`
  // return null; the built-in handler read `.propValue` off it and threw.
  it("no-ops for an unknown transform function", () => {
    const up = vi.fn()
    const property = {
      getOption: () => null,
      getParent: () => ({ getProperty: () => ({ getUnit: () => "", up }) }),
    } as unknown as Property

    expect(() =>
      typeProp.onChange!({
        property,
        from: {},
        to: { value: "matrix" },
        value: "matrix",
        opts: {},
      })
    ).not.toThrow()
    expect(up).not.toHaveBeenCalled()
  })

  it("pushes the option's units onto the value field", () => {
    const up = vi.fn()
    const property = {
      getOption: () => ({
        id: "rotate",
        propValue: { units: ["deg"], step: 1 },
      }),
      getParent: () => ({ getProperty: () => ({ getUnit: () => "px", up }) }),
    } as unknown as Property

    typeProp.onChange!({
      property,
      from: {},
      to: { value: "rotate" },
      value: "rotate",
      opts: {},
    })

    expect(up).toHaveBeenCalledWith({ units: ["deg"], step: 1, unit: "deg" })
  })
})
