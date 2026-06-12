// Structural validation for editor project payloads at the server-action
// boundary, mirroring how tenant themes are validated through `themeSchema`
// before persisting (see tenant-actions.ts). GrapesJS owns this format, so
// the schemas are deliberately permissive: they pin only the skeleton the
// React renderer walks (pages → frames → component trees) and let unknown
// keys pass through at every level. A schema that rejects a legitimate
// editor payload is a worse bug than no schema — when GrapesJS upgrades add
// new keys, `looseObject` admits them by design.

import { z } from "zod"

/**
 * Raw-payload byte cap, enforced before `JSON.parse`. Editor blobs are
 * typically tens of KB; 1 MB leaves generous headroom while bounding what
 * an unauthenticated caller can park in a `Json` column. Exported so it
 * can be raised deliberately (image-heavy `assets` arrays) and tested.
 */
export const MAX_PROJECT_BYTES = 1_000_000

const componentSchema = z.looseObject({
  type: z.string().optional(),
  tagName: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  get components() {
    return z.array(componentSchema).optional()
  },
})

const frameSchema = z.looseObject({ component: componentSchema.optional() })
const pageSchema = z.looseObject({ frames: z.array(frameSchema).optional() })

export const projectDefinitionSchema = z.looseObject({
  pages: z.array(pageSchema).optional(),
  styles: z.array(z.looseObject({})).optional(),
  // GrapesJS's asset manager accepts bare string URLs alongside object
  // descriptors, so admit both even though the renderer's `Asset` type
  // only models the object form.
  assets: z.array(z.union([z.string(), z.looseObject({})])).optional(),
})

/**
 * Validate an already-structured payload (e.g. a server-action argument
 * that never round-tripped through a string). Throws with a
 * user-surfaceable message — action errors land in editor toasts.
 */
export function validateProjectPayload(value: unknown): object {
  const parsed = projectDefinitionSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`Invalid project payload: ${parsed.error.message}.`)
  }
  return parsed.data
}

/**
 * Parse + validate a project payload posted as a JSON string. `label`
 * preserves the caller's historical wording ("project" vs "template") in
 * the parse-failure message the editor surfaces.
 */
export function parseProjectPayload(raw: string, label = "project"): object {
  if (Buffer.byteLength(raw, "utf8") > MAX_PROJECT_BYTES) {
    throw new Error("Project payload too large.")
  }
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error(`Invalid ${label} payload — could not parse JSON.`)
  }
  return validateProjectPayload(value)
}

/**
 * Validate a single component subtree (the convert-to-template flow posts
 * `cmp.toJSON()` rather than a full project). Rejects arrays, null, and
 * primitives — a subtree is one component object.
 */
export function validateComponentPayload(value: unknown): object {
  const parsed = componentSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`Invalid component payload: ${parsed.error.message}.`)
  }
  return parsed.data
}
