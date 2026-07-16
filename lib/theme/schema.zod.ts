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

export const tokenRegistrySchema = z.object({
  color: z
    .object({
      palette: z.array(tokenSchema).optional(),
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

export const elementsSchema = z.object({
  button: pseudoStyleBlockSchema.optional(),
  link: pseudoStyleBlockSchema.optional(),
  heading: pseudoStyleBlockSchema.optional(),
  h1: pseudoStyleBlockSchema.optional(),
  h2: pseudoStyleBlockSchema.optional(),
  h3: pseudoStyleBlockSchema.optional(),
  h4: pseudoStyleBlockSchema.optional(),
  h5: pseudoStyleBlockSchema.optional(),
  h6: pseudoStyleBlockSchema.optional(),
  caption: pseudoStyleBlockSchema.optional(),
  cite: pseudoStyleBlockSchema.optional(),
})

export const styleDefaultsSchema = styleBlockSchema.extend({
  elements: elementsSchema.optional(),
  components: z.record(z.string(), pseudoStyleBlockSchema).optional(),
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
