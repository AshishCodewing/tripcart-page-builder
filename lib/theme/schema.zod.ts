/**
 * Runtime Zod validator for the `Theme` document.
 *
 * Mirrors the TypeScript types in `./schema.ts` — they're hand-kept in
 * sync rather than derived (the TS types are the authoring contract;
 * Zod is the wire-validation contract). If you change one, change the
 * other. Drift is caught by Zod failing on a previously-valid payload
 * at runtime — surfaced through `updateTenantTheme`.
 *
 * Used by tenant-side server actions to reject malformed JSON before
 * it lands in the database. Not used in the editor read path, where
 * we trust the TS types to keep us honest.
 */

import { z } from "zod"

import type { CustomTree } from "@/lib/theme/schema"

const tokenSchema = z.object({
  slug: z.string().min(1),
  name: z.string(),
  value: z.string(),
})

const fontSizeTokenSchema = tokenSchema.extend({
  fluid: z
    .object({
      min: z.string(),
      max: z.string(),
    })
    .optional(),
})

const tokenRegistrySchema = z.object({
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

const colorStyleSchema = z
  .object({
    text: z.string().optional(),
    background: z.string().optional(),
  })
  .optional()

const typographyStyleSchema = z
  .object({
    fontFamily: z.string().optional(),
    fontSize: z.string().optional(),
    fontWeight: z.string().optional(),
    lineHeight: z.string().optional(),
    letterSpacing: z.string().optional(),
    textDecoration: z.string().optional(),
    textTransform: z.string().optional(),
  })
  .optional()

const boxStyleSchema = z
  .object({
    top: z.string().optional(),
    right: z.string().optional(),
    bottom: z.string().optional(),
    left: z.string().optional(),
  })
  .optional()

const spacingStyleSchema = z
  .object({
    padding: boxStyleSchema,
    margin: boxStyleSchema,
    blockGap: z.string().optional(),
  })
  .optional()

const borderStyleSchema = z
  .object({
    color: z.string().optional(),
    radius: z.string().optional(),
    style: z.string().optional(),
    width: z.string().optional(),
  })
  .optional()

const styleBlockSchema = z.object({
  color: colorStyleSchema,
  typography: typographyStyleSchema,
  spacing: spacingStyleSchema,
  border: borderStyleSchema,
  shadow: z.string().optional(),
})

const pseudoStyleBlockSchema = styleBlockSchema.extend({
  ":hover": styleBlockSchema.optional(),
  ":focus": styleBlockSchema.optional(),
  ":active": styleBlockSchema.optional(),
  ":visited": styleBlockSchema.optional(),
})

const elementsSchema = z.object({
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

const styleDefaultsSchema = styleBlockSchema.extend({
  elements: elementsSchema.optional(),
  components: z.record(z.string(), pseudoStyleBlockSchema).optional(),
})

const customTreeSchema: z.ZodType<CustomTree> = z.lazy(() =>
  z.record(z.string(), z.union([z.string(), customTreeSchema]))
)

export const themeSchema = z.object({
  version: z.literal(1),
  settings: tokenRegistrySchema,
  styles: styleDefaultsSchema.optional(),
  custom: customTreeSchema.optional(),
})
