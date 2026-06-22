// Pure form-parsing / validation helpers for the template server actions.
// No DB access and no "use server" — these run inside the actions in
// ../template-actions.ts, which keeps the server-action boundary.

import type { TemplateKind } from "@/generated/prisma/enums"

import { titleToSlug, validateSlug } from "../path"
import { assertReservedSlug, slimTemplateProject } from "../templates"
import {
  parseProjectPayload,
  validateComponentPayload,
} from "../project-payload"

const isKind = (v: string): v is TemplateKind =>
  v === "LAYOUT" || v === "PATTERN" || v === "PART"

export type TemplateMetadata = {
  title: string
  kind: TemplateKind
  area: string | null
  synced: boolean
  slug: string
  slugChanged: boolean
}

// Parse the editable metadata (§4) from a saveTemplate form, falling back to
// the existing row for any field the caller omitted so partial/non-editor
// callers never wipe data.
export function parseTemplateMetadata(
  form: FormData,
  existing: {
    title: string
    kind: TemplateKind
    area: string | null
    slug: string
  }
): TemplateMetadata {
  const titleField = form.get("title")
  const title =
    typeof titleField === "string" && titleField.trim()
      ? titleField.trim()
      : existing.title

  const kindField = form.get("kind")
  const kind =
    typeof kindField === "string" && isKind(kindField)
      ? kindField
      : existing.kind

  // Area is no longer editable from the right panel (like WP, only the title
  // is renamed there), so the editor form omits it — preserve the existing
  // value. When a caller does submit `area` (e.g. the create dialog), keep the
  // old behavior: apply it for PART, clear it otherwise.
  const areaField = form.get("area")
  const area =
    typeof areaField === "string"
      ? kind === "PART" && areaField.trim()
        ? areaField.trim()
        : null
      : existing.area

  // PARTs are synced by intent (a template part is always a by-reference
  // include, like WP — editing it propagates; it is never "unsynced"), so
  // never downgrade one. For LAYOUT/PATTERN the Base UI Switch posts "on"
  // when checked, nothing when unchecked.
  const synced = kind === "PART" ? true : form.get("synced") === "on"

  const slugField = form.get("slug")
  const slug =
    typeof slugField === "string" && slugField.trim()
      ? slugField.trim()
      : existing.slug

  return {
    title,
    kind,
    area,
    synced,
    slug,
    slugChanged: slug !== existing.slug,
  }
}

// Parse the canvas body out of a saveTemplate form. The editor injects the
// full `editor.getProjectData()` shape under `data`; non-editor callers omit
// it (→ undefined, preserve existing tree). Slimmed to the §9
// `{ component, styles }` form before persisting.
export function parseTemplateBody(
  form: FormData
): ReturnType<typeof slimTemplateProject> | undefined {
  const dataField = form.get("data")
  if (typeof dataField !== "string" || !dataField.length) return undefined
  const project = parseProjectPayload(dataField, "template")
  return slimTemplateProject(project)
}

export type SelectionInput = {
  title: string
  kind: TemplateKind
  area: string
  synced: boolean
  subtree: ReturnType<typeof validateComponentPayload>
  styles: unknown[]
  baseSlug: string
}

// Validate + parse a createTemplateFromSelection form into a structured,
// persistence-ready input (everything except the async slug dedupe). Throws
// with a user-facing message on any invalid field.
export function parseSelectionForm(form: FormData): SelectionInput {
  const title = String(form.get("title") ?? "").trim()
  const kindField = String(form.get("kind") ?? "").trim()
  const areaField = String(form.get("area") ?? "").trim()
  const synced = form.get("synced") === "true"
  const subtreeField = form.get("subtree")

  if (!title) throw new Error("Title is required.")
  if (!isKind(kindField))
    throw new Error("Kind must be LAYOUT, PATTERN, or PART.")
  const kind = kindField
  if (kind === "PART" && !areaField)
    throw new Error("Area is required for PART templates.")

  if (typeof subtreeField !== "string" || subtreeField.length === 0)
    throw new Error("Selected component data is required.")
  let parsedSubtree: unknown
  try {
    parsedSubtree = JSON.parse(subtreeField)
  } catch {
    throw new Error("Invalid subtree payload — could not parse JSON.")
  }
  const subtree = validateComponentPayload(parsedSubtree)

  // Optional `styles` snapshot from the dialog — page-scoped CSS rules that
  // target the subtree. Riding with the template keeps it self-contained when
  // the page's styles[] gets pruned on the next save.
  const stylesField = form.get("styles")
  let styles: unknown[] = []
  if (typeof stylesField === "string" && stylesField.length) {
    try {
      const parsed = JSON.parse(stylesField)
      if (Array.isArray(parsed)) styles = parsed
    } catch {
      throw new Error("Invalid styles payload — could not parse JSON.")
    }
  }

  const baseSlug = titleToSlug(title)
  if (!baseSlug)
    throw new Error("Title must contain at least one letter or number.")
  validateSlug(baseSlug)
  // Converting to a PART at "header"/"footer" is the intended way to author
  // site chrome; converting to a PATTERN/LAYOUT at those slugs is rejected.
  assertReservedSlug(baseSlug, kind)

  return { title, kind, area: areaField, synced, subtree, styles, baseSlug }
}
