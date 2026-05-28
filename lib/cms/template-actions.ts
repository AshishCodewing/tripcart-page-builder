"use server"

import { updateTag } from "next/cache"

import { prisma } from "@/lib/prisma"

import { cacheTags } from "./cache-tags"
import { titleToSlug, validateSlug } from "./path"

/**
 * Persist edits to a Template from the editor shell.
 *
 * MVP scope: only the canvas content (`data`) and `status` are updated
 * here. Metadata edits (renaming slug, switching kind, toggling synced,
 * changing area) will land alongside the templates admin index page —
 * the editor right-panel currently doesn't surface those fields for
 * templates.
 *
 * Cache invalidation: bumps the `template:<slug>` tag so any future
 * resolver caching keyed on the slug picks up the new content on the
 * next render.
 */
export async function saveTemplate(id: string, form: FormData): Promise<void> {
  const existing = await prisma.template.findUnique({ where: { id } })
  if (!existing) throw new Error("Template not found.")

  const status =
    (form.get("status") as "DRAFT" | "PUBLISHED" | null) ?? existing.status

  // The editor shell injects this on submit as the full
  // `editor.getProjectData()` shape (`{ pages: [{ frames: [{ component }] }], styles, ... }`).
  // Non-editor callers omit it, in which case we preserve the existing
  // tree. We slim the project shape down to the §9 `{ component, styles }`
  // form before persisting — see `TemplateBody` in lib/cms/templates.ts.
  const dataField = form.get("data")
  let body: { component: unknown; styles: unknown[] } | undefined
  if (typeof dataField === "string" && dataField.length) {
    let project: {
      pages?: Array<{ frames?: Array<{ component?: unknown }> }>
      styles?: unknown[]
    }
    try {
      project = JSON.parse(dataField)
    } catch {
      throw new Error("Invalid template payload — could not parse JSON.")
    }
    const component = project?.pages?.[0]?.frames?.[0]?.component
    if (!component)
      throw new Error("Template payload missing a root component.")
    body = {
      component,
      styles: Array.isArray(project?.styles) ? project.styles : [],
    }
  }

  const wasPublished = existing.status === "PUBLISHED"
  const willBePublished = status === "PUBLISHED"

  await prisma.template.update({
    where: { id },
    data: {
      status,
      publishedAt:
        willBePublished && !wasPublished ? new Date() : existing.publishedAt,
      ...(body !== undefined ? { data: body as object } : {}),
    },
  })

  updateTag(cacheTags.template(existing.slug))
}

/**
 * Create a new Template from a selection in the page editor. Called by
 * the convert-to-template dialog (see `convertTemplatePlugin` + the
 * dialog component). The caller serializes the selected GrapesJS
 * component via `cmp.toJSON()` and posts it as the `subtree` field.
 *
 * Always tenant-scoped — global library writes live elsewhere (see §3
 * of docs/templates-followups.md). Slug is derived from the title and
 * de-duplicated against the tenant's existing templates by appending
 * `-2`, `-3`, ... — surfaces no slug input in the modal to keep the
 * create flow single-field.
 *
 * Returns the new id + final slug so the client can swap the selection
 * with a `template-ref` when `synced=true`.
 */
export type CreatedTemplate = {
  id: string
  slug: string
  title: string
  kind: "LAYOUT" | "PATTERN" | "PART"
  area: string | null
  synced: boolean
}

export async function createTemplateFromSelection(
  tenantId: string,
  form: FormData
): Promise<CreatedTemplate> {
  if (!tenantId) throw new Error("Tenant is required.")

  const title = String(form.get("title") ?? "").trim()
  const kindField = String(form.get("kind") ?? "").trim()
  const areaField = String(form.get("area") ?? "").trim()
  const synced = form.get("synced") === "true"
  const subtreeField = form.get("subtree")

  if (!title) throw new Error("Title is required.")
  if (kindField !== "LAYOUT" && kindField !== "PATTERN" && kindField !== "PART")
    throw new Error("Kind must be LAYOUT, PATTERN, or PART.")
  const kind = kindField as "LAYOUT" | "PATTERN" | "PART"
  if (kind === "PART" && !areaField)
    throw new Error("Area is required for PART templates.")

  if (typeof subtreeField !== "string" || subtreeField.length === 0)
    throw new Error("Selected component data is required.")
  let subtree: unknown
  try {
    subtree = JSON.parse(subtreeField)
  } catch {
    throw new Error("Invalid subtree payload — could not parse JSON.")
  }
  if (!subtree || typeof subtree !== "object")
    throw new Error("Subtree must be a component object.")

  // Optional `styles` snapshot from the dialog — page-scoped CSS rules
  // that target the subtree (e.g. Style-Manager-edited `#id { ... }`).
  // Riding with the template instead of relying on the page keeps the
  // template self-contained when the page's styles[] gets pruned on
  // the next save after the conversion.
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

  // Derive a slug from the title and resolve collisions by appending
  // -2, -3, ... per (tenantId, slug). One round-trip per existing
  // collision is fine for the convert flow — slugs are tenant-scoped
  // and contention is naturally low.
  const baseSlug = titleToSlug(title)
  if (!baseSlug)
    throw new Error("Title must contain at least one letter or number.")
  validateSlug(baseSlug)
  let slug = baseSlug
  let suffix = 2
  while (
    await prisma.template.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${suffix}`
    suffix++
  }

  // §9 slim shape — a template is a component + its styles, not a
  // one-page project that happens to be a template. The editor wraps
  // back into the full `ProjectDefinition` shape at load time; the
  // resolver reads `tpl.data.component` directly.
  const body = {
    component: subtree,
    styles,
  }

  const created = await prisma.template.create({
    data: {
      tenantId,
      slug,
      title,
      kind,
      area: kind === "PART" ? areaField : null,
      synced,
      status: "DRAFT",
      data: body as object,
    },
    select: { id: true, slug: true, title: true, kind: true, area: true, synced: true },
  })

  updateTag(cacheTags.template(slug))
  return created
}
