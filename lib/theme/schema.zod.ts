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
})

/**
 * Root-only spacing. `blockGap` is WP's vertical rhythm between stacked blocks
 * — it compiles to the `--tc--style--block-gap` variable that drives the
 * `.tc-entry-content` flow spacing in tc-normalize.css, NOT to a CSS `gap`
 * declaration. Flex/grid gap on a block is `layout.gap`, which is a different
 * thing, so `blockGap` lives only where it means something.
 */
export const rootSpacingStyleSchema = spacingStyleSchema.extend({
  blockGap: z.string().optional(),
})

export const borderStyleSchema = z.object({
  color: z.string().optional(),
  radius: z.string().optional(),
  style: z.string().optional(),
  width: z.string().optional(),
})

// Container layout. Deliberately narrow: the flex box-alignment properties a
// theme can meaningfully default, and `display` so a block can be made flex or
// full-width. Grid tracks, position and float are per-instance decisions and
// stay in the page editor.
export const layoutStyleSchema = z.object({
  display: z.string().optional(),
  flexDirection: z.string().optional(),
  flexWrap: z.string().optional(),
  gap: z.string().optional(),
  justifyContent: z.string().optional(),
  alignItems: z.string().optional(),
  alignContent: z.string().optional(),
})

// Background layers, as the editor's background stack writes them: five
// longhands, each a comma-separated list with one entry per layer. The colour
// itself stays under `color.background`, mirroring WP.
export const backgroundStyleSchema = z.object({
  image: z.string().optional(),
  repeat: z.string().optional(),
  position: z.string().optional(),
  attachment: z.string().optional(),
  size: z.string().optional(),
})

// Effects a brand plausibly sets once: a hover transition on every button, a
// text shadow on every heading. Each is a single composed string, which is how
// the editor's stacks (`text-shadow`, `transition`, `transform`) and the filter
// plugin write them. `box-shadow` predates this group and lives at `shadow`.
export const effectsStyleSchema = z.object({
  opacity: z.string().optional(),
  cursor: z.string().optional(),
  textShadow: z.string().optional(),
  filter: z.string().optional(),
  backdropFilter: z.string().optional(),
  transition: z.string().optional(),
  transform: z.string().optional(),
})

export const styleBlockSchema = z.object({
  layout: layoutStyleSchema.optional(),
  color: colorStyleSchema.optional(),
  typography: typographyStyleSchema.optional(),
  spacing: spacingStyleSchema.optional(),
  background: backgroundStyleSchema.optional(),
  border: borderStyleSchema.optional(),
  shadow: z.string().optional(),
  effects: effectsStyleSchema.optional(),
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
  const { states, ...base } = block
  // Absent `supports` means every group; a part narrows it only where a group
  // would break the block.
  const supports = decl.supports ?? STYLE_GROUPS
  const rejectGroups = (
    b: z.infer<typeof styleBlockSchema>,
    at: typeof path
  ) => {
    for (const group of STYLE_GROUPS) {
      if (b[group] !== undefined && !supports.includes(group)) {
        ctx.addIssue({
          code: "custom",
          path: [...at, group],
          message: `"${decl.label}" does not support "${group}" (supports: ${supports.join(", ")})`,
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
  // Widened for `blockGap`, which only the root block can express.
  spacing: rootSpacingStyleSchema.optional(),
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
