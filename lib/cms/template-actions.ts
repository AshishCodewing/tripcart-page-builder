"use server"

import { updateTag } from "next/cache"
import { redirect } from "next/navigation"

import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"

import { cacheTags } from "./cache-tags"
import { titleToSlug, validateSlug } from "./path"
import {
  parseProjectPayload,
  validateComponentPayload,
} from "./project-payload"
import {
  assertChromeSlug,
  slimTemplateProject,
  templateRefExists,
} from "./templates"

/**
 * Persist edits to a Template from the editor shell.
 *
 * Saves both the canvas content (`data`) and the editable metadata (§4):
 * title, slug, kind, area, synced. Missing fields fall back to the
 * existing values so partial/non-editor callers don't wipe data. Area is
 * only meaningful for PART and is cleared for LAYOUT/PATTERN.
 *
 * Slug rename is guarded: it must stay unique within the template's
 * tenant scope, and is forbidden while any `template-ref` points at the
 * current slug (renaming would silently break those refs — §4 option 1).
 *
 * Cache invalidation: bumps the `template:<slug>` tag (old and new on a
 * rename) so any resolver caching keyed on the slug picks up the change
 * on the next render.
 */
export async function saveTemplate(id: string, form: FormData): Promise<void> {
  const existing = await prisma.template.findUnique({ where: { id } })
  if (!existing) throw new Error("Template not found.")

  // --- Metadata (§4) -----------------------------------------------------
  const titleField = form.get("title")
  const title =
    typeof titleField === "string" && titleField.trim()
      ? titleField.trim()
      : existing.title

  const kindField = form.get("kind")
  const kind =
    kindField === "LAYOUT" || kindField === "PATTERN" || kindField === "PART"
      ? kindField
      : existing.kind

  // Area only applies to PART; cleared otherwise.
  const areaField = form.get("area")
  const area =
    kind === "PART" && typeof areaField === "string" && areaField.trim()
      ? areaField.trim()
      : null

  // Base UI Switch posts "on" when checked, nothing when unchecked.
  const synced = form.get("synced") === "on"

  const slugField = form.get("slug")
  const slug =
    typeof slugField === "string" && slugField.trim()
      ? slugField.trim()
      : existing.slug
  const slugChanged = slug !== existing.slug
  // A reserved chrome slug ("header"/"footer") may only be a PART — checked
  // unconditionally so changing kind on an existing chrome slug is caught too.
  assertChromeSlug(slug, kind)
  if (slugChanged) {
    validateSlug(slug)
    // Per-tenant slug uniqueness (globals share the null-tenant space).
    const clash = await prisma.template.findFirst({
      where: { tenantId: existing.tenantId, slug, id: { not: id } },
      select: { id: true },
    })
    if (clash) {
      throw new Error(`A template with slug "${slug}" already exists.`)
    }
    if (await templateRefExists(existing.slug)) {
      throw new Error(
        `Cannot rename "${existing.slug}" — it is referenced by existing ` +
          `content. Remove those references before renaming.`
      )
    }
  }

  // The editor shell injects this on submit as the full
  // `editor.getProjectData()` shape (`{ pages: [{ frames: [{ component }] }], styles, ... }`).
  // Non-editor callers omit it, in which case we preserve the existing
  // tree. We slim the project shape down to the §9 `{ component, styles }`
  // form before persisting — see `slimTemplateProject` in lib/cms/templates.ts.
  const dataField = form.get("data")
  let body: ReturnType<typeof slimTemplateProject> | undefined
  if (typeof dataField === "string" && dataField.length) {
    const project = parseProjectPayload(dataField, "template")
    body = slimTemplateProject(project)
  }

  await prisma.template.update({
    where: { id },
    data: {
      title,
      slug,
      kind,
      area,
      synced,
      // Committing the editor state clears any pending autosave draft so
      // the next load seeds from `data`. Metadata-only saves (no `data`
      // field) leave the draft untouched.
      ...(body !== undefined
        ? { data: body as object, draftData: Prisma.DbNull }
        : {}),
    },
  })

  updateTag(cacheTags.template(existing.slug))
  if (slugChanged) updateTag(cacheTags.template(slug))
}

/**
 * Create a new Template from a selection in the page editor. Called by
 * the convert-to-template dialog (see `convertTemplatePlugin` + the
 * dialog component). The caller serializes the selected GrapesJS
 * component via `cmp.toJSON()` and posts it as the `subtree` field.
 *
 * Always tenant-scoped — global library writes live elsewhere (see §3
 * of docs/reference/templates-followups.md). Slug is derived from the title and
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

/**
 * Create a blank tenant-scoped Template from the Library admin pages and
 * jump straight into the editor. Unlike `createTemplateFromSelection`
 * (which captures an existing GrapesJS subtree), this seeds no content —
 * the row keeps the schema-default `data = {}`, which the editor opens as
 * an empty canvas (see the template edit page's `data === {}` handling).
 *
 * `kind` is constrained to LAYOUT | PATTERN here — the only two surfaced
 * by the Library (PART chrome is authored elsewhere). Slug is derived
 * from the title and de-duplicated per tenant, mirroring
 * `createTemplateFromSelection`. Redirects to the editor on success.
 */
export async function createTemplate(
  tenantId: string,
  form: FormData
): Promise<void> {
  if (!tenantId) throw new Error("Tenant is required.")

  const title = String(form.get("title") ?? "").trim()
  const kindField = String(form.get("kind") ?? "").trim()

  if (!title) throw new Error("Title is required.")
  if (kindField !== "LAYOUT" && kindField !== "PATTERN")
    throw new Error("Kind must be LAYOUT or PATTERN.")
  const kind = kindField as "LAYOUT" | "PATTERN"

  const baseSlug = titleToSlug(title)
  if (!baseSlug)
    throw new Error("Title must contain at least one letter or number.")
  validateSlug(baseSlug)
  // This path only creates LAYOUT/PATTERN, so a "Header"/"Footer" title would
  // claim a reserved chrome slug as a non-PART — reject it.
  assertChromeSlug(baseSlug, kind)
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

  const created = await prisma.template.create({
    data: { tenantId, slug, title, kind },
    select: { id: true },
  })

  updateTag(cacheTags.template(slug))
  redirect(`/admin/templates/${created.id}/edit`)
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
  let parsedSubtree: unknown
  try {
    parsedSubtree = JSON.parse(subtreeField)
  } catch {
    throw new Error("Invalid subtree payload — could not parse JSON.")
  }
  const subtree = validateComponentPayload(parsedSubtree)

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
  // Converting to a PART at "header"/"footer" is the intended way to author
  // site chrome; converting to a PATTERN/LAYOUT at those slugs is rejected.
  assertChromeSlug(baseSlug, kind)
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
      data: body as object,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      kind: true,
      area: true,
      synced: true,
    },
  })

  updateTag(cacheTags.template(slug))
  return created
}

/**
 * Delete a Template and return to the Library index.
 *
 * Reference impact (§5, resolved decision): deletion is *not* blocked
 * when `template-ref` nodes still point at the slug. Refs live inside
 * JSON columns with no FK link, so they're left in place — the resolver
 * already renders them as `missing:<slug>` placeholders once the row is
 * gone (see `resolvePageTree`). A pre-delete "reference inventory" view
 * (powered by `templateRefExists` / a future count) is the deferred
 * enhancement; for now delete is unconditional.
 *
 * Bumps the `template:<slug>` tag so any resolver caching keyed on the
 * slug drops the stale body. Redirects to the kind's Library route
 * (PATTERN → patterns, LAYOUT/PART → templates); globals (no tenant)
 * fall back to the all-tenants listing.
 */
export async function deleteTemplate(id: string): Promise<void> {
  const tpl = await prisma.template.findUnique({
    where: { id },
    select: { slug: true, kind: true, tenantId: true },
  })
  if (!tpl) return

  await prisma.template.delete({ where: { id } })
  updateTag(cacheTags.template(tpl.slug))

  if (!tpl.tenantId) redirect("/admin/tenants")
  const section = tpl.kind === "PATTERN" ? "patterns" : "templates"
  redirect(`/admin/tenants/${tpl.tenantId}/library/${section}`)
}

/**
 * Delete one or more Templates without navigating — backs the Library
 * data-table's row + bulk delete. Same unconditional reference policy as
 * `deleteTemplate` (refs degrade to `missing:<slug>` placeholders). The
 * caller refreshes the route (`router.refresh()`) after this resolves;
 * we bump each affected `template:<slug>` tag so resolver caches drop.
 */
export async function bulkDeleteTemplates(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const rows = await prisma.template.findMany({
    where: { id: { in: ids } },
    select: { slug: true },
  })
  await prisma.template.deleteMany({ where: { id: { in: ids } } })
  for (const row of rows) updateTag(cacheTags.template(row.slug))
}

/**
 * Clone a Template in place — backs the Library data-table's "Duplicate"
 * row action. Copies every authored field (kind, area, synced, preview,
 * description, data) into a new row in the same tenant scope, with a
 * `"<slug>-copy"` slug (deduped `-copy-2`, `-copy-3`, …) and a
 * `"<title> (copy)"` title. Stays on the listing — the caller refreshes
 * the route so the new row appears; no redirect into the editor.
 */
export async function duplicateTemplate(id: string): Promise<void> {
  const tpl = await prisma.template.findUnique({ where: { id } })
  if (!tpl) throw new Error("Template not found.")

  const baseSlug = `${tpl.slug}-copy`
  let slug = baseSlug
  let suffix = 2
  // findFirst (not findUnique on the compound key) so globals — where
  // tenantId is null — dedupe correctly; SQL nulls aren't unique-comparable.
  while (
    await prisma.template.findFirst({
      where: { tenantId: tpl.tenantId, slug },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${suffix}`
    suffix++
  }

  await prisma.template.create({
    data: {
      tenantId: tpl.tenantId,
      slug,
      title: `${tpl.title} (copy)`,
      kind: tpl.kind,
      area: tpl.area,
      synced: tpl.synced,
      description: tpl.description,
      preview: tpl.preview,
      data: tpl.data as Prisma.InputJsonValue,
    },
  })

  updateTag(cacheTags.template(slug))
}
