import { describe, expect, it } from "vitest"
import { z } from "zod"

import { compileTheme } from "@/lib/theme/compile"
import { styleBlockSchema } from "@/lib/theme/schema.zod"
import type { Theme } from "@/lib/theme/schema"
import { CSS_TO_PATH } from "@/lib/theme/style-css-map"
import { STYLE_GROUPS } from "@/lib/theme/style-surfaces"

const schemaAt = (path: readonly string[]): z.ZodTypeAny | undefined => {
  let current: z.ZodTypeAny = styleBlockSchema
  for (const key of path) {
    const unwrapped =
      current instanceof z.ZodOptional ? current.unwrap() : current
    if (!(unwrapped instanceof z.ZodObject)) return undefined
    const next: z.ZodTypeAny | undefined = unwrapped.shape[key]
    if (!next) return undefined
    current = next
  }
  return current
}

// A theme block that sets every property the schema allows, so compiling it
// tells us exactly which CSS declarations the theme can express.
const everything: Theme = {
  version: 1,
  settings: {},
  styles: {
    elements: {
      button: {
        layout: {
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: "1rem",
          justifyContent: "center",
          alignItems: "center",
          alignContent: "center",
          alignSelf: "center",
          order: "1",
          flex: "1 1 auto",
        },
        color: { text: "red", background: "blue" },
        typography: {
          fontFamily: "serif",
          fontSize: "1rem",
          fontStyle: "italic",
          fontWeight: "700",
          lineHeight: "1.5",
          letterSpacing: "0.01em",
          textDecoration: "none",
          textTransform: "uppercase",
        },
        spacing: {
          padding: { top: "1px", right: "2px", bottom: "3px", left: "4px" },
          margin: { top: "1px", right: "2px", bottom: "3px", left: "4px" },
        },
        background: {
          image: "url(a.png)",
          repeat: "no-repeat",
          position: "center",
          attachment: "scroll",
          size: "cover",
        },
        border: {
          color: "red",
          radius: "4px",
          style: "solid",
          width: "1px",
        },
        shadow: "0 0 1px red",
        effects: {
          opacity: "0.9",
          cursor: "pointer",
          textShadow: "0 1px 0 black",
          filter: "blur(1px)",
          backdropFilter: "blur(2px)",
          transition: "all 0.2s",
          transform: "scale(1)",
        },
      },
    },
  },
}

const compiledProperties = new Set(
  compileTheme(everything).rules.flatMap((rule) => Object.keys(rule.style))
)

describe("theme CSS map", () => {
  it("maps every property to a path the style-block schema declares", () => {
    for (const [property, path] of Object.entries(CSS_TO_PATH)) {
      expect(schemaAt(path), property).toBeDefined()
    }
  })

  it("only names declarations the compiler actually emits", () => {
    for (const property of Object.keys(CSS_TO_PATH)) {
      expect(compiledProperties.has(property), property).toBe(true)
    }
  })

  it("covers every declaration the compiler emits", () => {
    const missing = [...compiledProperties].filter((p) => !CSS_TO_PATH[p])
    expect(missing).toEqual([])
  })

  it("files every property under a real style group", () => {
    for (const [property, path] of Object.entries(CSS_TO_PATH)) {
      expect(STYLE_GROUPS, property).toContain(path[0])
    }
  })

  it("looks a property up, and returns nothing for one it can't store", () => {
    expect(CSS_TO_PATH["padding-top"]).toEqual(["spacing", "padding", "top"])
    expect(CSS_TO_PATH.gap).toEqual(["layout", "gap"])
    // Per-instance decisions the theme deliberately doesn't store.
    expect(CSS_TO_PATH.position).toBeUndefined()
    expect(CSS_TO_PATH["grid-template-columns"]).toBeUndefined()
  })
})
