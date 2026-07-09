import { describe, expect, it } from "vitest"

import { compileCssArtifact } from "./css-artifacts"
import { cssContentKey } from "@/lib/plugins/react-renderer/project/css-helpers"

const redRule = { selectors: ["a"], style: { color: "red" } }

describe("compileCssArtifact", () => {
  it("compiles a full ProjectData shape (Page/Post data)", () => {
    const { css, cssHash } = compileCssArtifact({
      pages: [{ id: "home", frames: [] }],
      styles: [redRule],
    })
    expect(css).toBe(".a{color:red;}")
    expect(cssHash).toBe(cssContentKey(css))
  })

  it("compiles the slim template body shape to the same CSS", () => {
    const { css } = compileCssArtifact({
      component: { tagName: "header" },
      styles: [redRule],
    })
    expect(css).toBe(".a{color:red;}")
  })

  it("strips protected (theme) rules", () => {
    const { css } = compileCssArtifact({
      styles: [
        { selectors: [":root"], style: { "--x": "1" }, protected: true },
        redRule,
      ],
    })
    expect(css).toBe(".a{color:red;}")
  })

  it("bakes an empty-but-real artifact for rule-less data", () => {
    const empty = { css: "", cssHash: cssContentKey("") }
    expect(compileCssArtifact({})).toEqual(empty)
    expect(compileCssArtifact({ styles: [] })).toEqual(empty)
    expect(compileCssArtifact({ styles: "bogus" })).toEqual(empty)
  })

  it("hashes stably and diverges on content change", () => {
    const a = compileCssArtifact({ styles: [redRule] })
    const b = compileCssArtifact({ styles: [redRule] })
    const c = compileCssArtifact({
      styles: [{ selectors: ["a"], style: { color: "blue" } }],
    })
    expect(a.cssHash).toBe(b.cssHash)
    expect(c.cssHash).not.toBe(a.cssHash)
    // Regression vector: hash format/algorithm changes must be deliberate —
    // artifact URLs embed this value.
    expect(a.cssHash).toBe(cssContentKey(".a{color:red;}"))
  })
})
