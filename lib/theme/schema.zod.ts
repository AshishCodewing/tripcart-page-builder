/**
 * Zod schema for the `Theme` document — the single source of truth.
 *
 * The TypeScript contract in `./schema.ts` is DERIVED from these schemas
 * via `z.infer`; edit only this file when the theme shape changes. Drift
 * between the validator and the types is impossible by construction
 * (`lib/theme/schema.test.ts` pins the equivalence at compile time).
 *
 * Used by tenant-side server actions to reject malformed JSON before
 * it lands in the database (`updateTenantTheme`). Not used in the editor
 * read path, where we trust the TS types to keep us honest.
 *
 * Structure note: object schemas are plain (no `.optional()` baked into
 * the constants) with optionality applied at each usage site — required
 * so the inferred types put `| undefined` at the property layer, matching
 * the authoring contract.
 */

import { z } from "zod"

import {
  getStyleSurface,
  STYLE_GROUPS,
  type StylePart,
} from "@/lib/theme/style-surfaces"

export const tokenSchema = z.object({
  slug: z.string().min(1),
  name: z.string(),
  value: z.string(),
})

export const fontSizeTokenSchema = tokenSchema.extend({
  fluid: z
    .object({
      min: z.string(),
      max: z.string(),
    })
    .optional(),
})

/**
 * Color tokens carry an optional `dark` value. When present, the compiler
 * emits it under `@media (prefers-color-scheme: dark)` (the Open Props
 * adaptive convention) so the token flips automatically on OS dark mode —
 * no `.dark` class, works in the preview document and canvas iframe alike.
 * A token with no `dark` value stays fixed across both schemes.
 */
export const colorTokenSchema = tokenSchema.extend({
  dark: z.string().optional(),
})

export const tokenRegistrySchema = z.object({
  color: z
    .object({
      palette: z.array(colorTokenSchema).optional(),
    })
    .optional(),
  typography: z
    .object({
      fontFamilies: z.array(tokenSchema).optional(),
      fontSizes: z.array(fontSizeTokenSchema).optional(),
      fontWeights: z.array(tokenSchema).optional(),
      lineHeights: z.array(tokenSchema).optional(),
      letterSpacings: z.array(tokenSchema).optional(),
    })
    .optional(),
  spacing: z
    .object({
      sizes: z.array(tokenSchema).optional(),
    })
    .optional(),
  border: z
    .object({
      radii: z.array(tokenSchema).optional(),
      widths: z.array(tokenSchema).optional(),
      styles: z.array(tokenSchema).optional(),
    })
    .optional(),
  shadow: z
    .object({
      presets: z.array(tokenSchema).optional(),
    })
    .optional(),
  layout: z
    .object({
      contentSize: z.string().optional(),
      wideSize: z.string().optional(),
    })
    .optional(),
  dimensions: z
    .object({
      minHeight: z.string().optional(),
    })
    .optional(),
})

export const colorStyleSchema = z.object({
  text: z.string().optional(),
  background: z.string().optional(),
})

export const typographyStyleSchema = z.object({
  fontFamily: z.string().optional(),
  fontSize: z.string().optional(),
  fontStyle: z.string().optional(),
  fontWeight: z.string().optional(),
  lineHeight: z.string().optional(),
  letterSpacing: z.string().optional(),
  textDecoration: z.string().optional(),
  textTransform: z.string().optional(),
})

export const boxStyleSchema = z.object({
  top: z.string().optional(),
  right: z.string().optional(),
  bottom: z.string().optional(),
  left: z.string().optional(),
})

export const spacingStyleSchema = z.object({
  padding: boxStyleSchema.optional(),
  margin: boxStyleSchema.optional(),
  blockGap: z.string().optional(),
})

export const borderStyleSchema = z.object({
  color: z.string().optional(),
  radius: z.string().optional(),
  style: z.string().optional(),
  width: z.string().optional(),
})

export const styleBlockSchema = z.object({
  color: colorStyleSchema.optional(),
  typography: typographyStyleSchema.optional(),
  spacing: spacingStyleSchema.optional(),
  border: borderStyleSchema.optional(),
  shadow: z.string().optional(),
})

export const pseudoStyleBlockSchema = styleBlockSchema.extend({
  ":hover": styleBlockSchema.optional(),
  ":focus": styleBlockSchema.optional(),
  ":active": styleBlockSchema.optional(),
  ":visited": styleBlockSchema.optional(),
})

// WP-style block style variations (`is-style-<slug>`): the theme owns the
// look of each named variant; a block only toggles the class.
export const elementStyleSchema = pseudoStyleBlockSchema.extend({
  variations: z.record(z.string(), pseudoStyleBlockSchema).optional(),
})

export const elementsSchema = z.object({
  button: elementStyleSchema.optional(),
  link: elementStyleSchema.optional(),
  heading: elementStyleSchema.optional(),
  h1: elementStyleSchema.optional(),
  h2: elementStyleSchema.optional(),
  h3: elementStyleSchema.optional(),
  h4: elementStyleSchema.optional(),
  h5: elementStyleSchema.optional(),
  h6: elementStyleSchema.optional(),
  caption: elementStyleSchema.optional(),
  cite: elementStyleSchema.optional(),
})

// Per-block styles (WP's `styles.blocks.<name>`). A block declares its
// parts, allowed style groups and state suffixes in a `StyleSurface`;
// `states` keys are those suffixes (`:hover`, `[aria-selected="true"]`).
export const partStyleSchema = styleBlockSchema.extend({
  states: z.record(z.string(), styleBlockSchema).optional(),
})

export const componentStyleSchema = partStyleSchema.extend({
  parts: z.record(z.string(), partStyleSchema).optional(),
})

type PartStyle = z.infer<typeof partStyleSchema>

const checkPartAgainstSurface = (
  ctx: z.RefinementCtx,
  path: (string | number)[],
  block: PartStyle,
  decl: StylePart
): void => {
  const groupsIn = (b: z.infer<typeof styleBlockSchema>) =>
    STYLE_GROUPS.filter((g) => b[g] !== undefined)
  const { states, ...base } = block
  const rejectGroups = (
    b: z.infer<typeof styleBlockSchema>,
    at: typeof path
  ) => {
    for (const group of groupsIn(b)) {
      if (!decl.supports.includes(group)) {
        ctx.addIssue({
          code: "custom",
          path: [...at, group],
          message: `"${decl.label}" does not support "${group}" (supports: ${decl.supports.join(", ")})`,
        })
      }
    }
  }
  rejectGroups(base, path)
  for (const [state, stateBlock] of Object.entries(states ?? {})) {
    if (!decl.states.includes(state)) {
      ctx.addIssue({
        code: "custom",
        path: [...path, "states", state],
        message: `"${decl.label}" has no state "${state}" (states: ${decl.states.join(", ") || "none"})`,
      })
      continue
    }
    rejectGroups(stateBlock, [...path, "states", state])
  }
}

// Types without a registered surface pass through untouched: the compiler
// emits nothing for them, and rejecting them would block a tenant whose
// saved theme still names a retired block from saving anything at all.
export const componentsSchema = z
  .record(z.string(), componentStyleSchema)
  .superRefine((components, ctx) => {
    for (const [type, block] of Object.entries(components)) {
      const surface = getStyleSurface(type)
      if (!surface) continue
      const { parts, ...root } = block
      checkPartAgainstSurface(ctx, [type], root, surface.root)
      for (const [name, part] of Object.entries(parts ?? {})) {
        const decl = surface.parts[name]
        if (!decl) {
          ctx.addIssue({
            code: "custom",
            path: [type, "parts", name],
            message: `"${surface.label}" has no part "${name}" (parts: ${Object.keys(surface.parts).join(", ")})`,
          })
          continue
        }
        checkPartAgainstSurface(ctx, [type, "parts", name], part, decl)
      }
    }
  })

export const styleDefaultsSchema = styleBlockSchema.extend({
  elements: elementsSchema.optional(),
  components: componentsSchema.optional(),
})

// Recursive types still need a hand-written shape — Zod can't infer a
// self-referential record. `CustomTree` lives here (next to its schema)
// and is re-exported by schema.ts so importers see one canonical name.
export type CustomTree = { [key: string]: string | CustomTree }

export const customTreeSchema: z.ZodType<CustomTree> = z.lazy(() =>
  z.record(z.string(), z.union([z.string(), customTreeSchema]))
)

export const themeSchema = z.object({
  version: z.literal(1),
  settings: tokenRegistrySchema,
  styles: styleDefaultsSchema.optional(),
  custom: customTreeSchema.optional(),
})
