import { describe, expect, it } from "vitest"
import type { z } from "zod"

import type { Theme } from "@/lib/theme/schema"
import { themeSchema } from "@/lib/theme/schema.zod"

// Representative full document: tokens in every registry category, a fluid
// font size, root + element + component styles with pseudo blocks, and a
// nested `custom` tree. Typed as `Theme` so the fixture itself is one half
// of the compile-time drift detector below.
const themeFixture: Theme = {
  version: 1,
  settings: {
    color: {
      palette: [
        { slug: "primary", name: "Primary", value: "hsl(var(--blue-6-hsl))" },
        { slug: "surface", name: "Surface", value: "hsl(var(--gray-0-hsl))" },
      ],
    },
    typography: {
      fontFamilies: [{ slug: "sans", name: "Sans", value: "var(--font-sans)" }],
      fontSizes: [
        { slug: "md", name: "Medium", value: "var(--font-size-1)" },
        {
          slug: "xl",
          name: "Extra large",
          value: "var(--font-size-4)",
          fluid: { min: "1.5rem", max: "2.5rem" },
        },
      ],
      fontWeights: [{ slug: "bold", name: "Bold", value: "700" }],
      lineHeights: [{ slug: "tight", name: "Tight", value: "1.2" }],
      letterSpacings: [{ slug: "wide", name: "Wide", value: "0.02em" }],
    },
    spacing: { sizes: [{ slug: "sm", name: "Small", value: "var(--size-2)" }] },
    border: {
      radii: [{ slug: "round", name: "Round", value: "var(--radius-3)" }],
      widths: [{ slug: "thin", name: "Thin", value: "1px" }],
      styles: [{ slug: "solid", name: "Solid", value: "solid" }],
    },
    shadow: {
      presets: [{ slug: "low", name: "Low", value: "var(--shadow-2)" }],
    },
    layout: { contentSize: "65ch", wideSize: "80rem" },
    dimensions: { minHeight: "100vh" },
  },
  styles: {
    color: { text: "var:preset|color|primary", background: "white" },
    typography: { fontSize: "var:preset|typography|md" },
    spacing: {
      padding: {
        top: "var:preset|spacing|sm",
        bottom: "var:preset|spacing|sm",
      },
      margin: { left: "auto", right: "auto" },
      blockGap: "1rem",
    },
    border: { radius: "var:preset|border|round" },
    shadow: "var:preset|shadow|low",
    elements: {
      button: {
        color: { background: "var:preset|color|primary" },
        ":hover": { color: { background: "var:preset|color|surface" } },
      },
      h1: { typography: { fontSize: "var:preset|typography|xl" } },
    },
    components: {
      "tc-hero": {
        color: { text: "white" },
        ":focus": { border: { color: "var:preset|color|primary" } },
      },
    },
  },
  custom: {
    sectionGap: "var(--size-7)",
    hero: { overlay: { opacity: "0.6" } },
  },
}

describe("themeSchema", () => {
  it("accepts a representative full theme", () => {
    const parsed = themeSchema.safeParse(themeFixture)
    expect(parsed.success).toBe(true)
  })

  it("rejects an unknown version", () => {
    expect(themeSchema.safeParse({ ...themeFixture, version: 2 }).success).toBe(
      false
    )
  })

  it("rejects a token missing its slug", () => {
    const broken = {
      ...themeFixture,
      settings: {
        color: { palette: [{ name: "Primary", value: "blue" }] },
      },
    }
    expect(themeSchema.safeParse(broken).success).toBe(false)
  })

  it("rejects a custom leaf that is not a string", () => {
    const broken = { ...themeFixture, custom: { hero: { opacity: 0.6 } } }
    expect(themeSchema.safeParse(broken).success).toBe(false)
  })

  // The drift detector: `Theme` (schema.ts) and `z.infer<typeof themeSchema>`
  // (schema.zod.ts) must stay mutually assignable. Either assignment failing
  // turns a runtime-only drift into a `pnpm typecheck` failure.
  it("keeps Theme and z.infer<typeof themeSchema> mutually assignable", () => {
    const parsed = themeSchema.parse(themeFixture)
    const fromInferred: Theme = parsed
    const toInferred: z.infer<typeof themeSchema> = themeFixture
    expect(fromInferred).toBeTruthy()
    expect(toInferred).toBeTruthy()
  })
})
