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
  isReservedChromeSlug,
  slimTemplateProject,
  templateRefUsage,
} from "./templates"
import { formatTemplateRefUsage } from "./template-ref-usage"
import { getHierarchyEntry, isHierarchySlug } from "./template-hierarchy"
import { BUILTIN_PATTERNS } from "@/lib/plugins/patterns/manifest"
import { defaultFooter, defaultHeader } from "@/lib/plugins/parts"

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
  // never downgrade one. Matches `createTemplate`, which seeds PART synced.
  // For LAYOUT/PATTERN the Base UI Switch posts "on" when checked, nothing
  // when unchecked.
  const synced = kind === "PART" ? true : form.get("synced") === "on"

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
    const usage = await templateRefUsage(existing.slug)
    if (usage.total > 0) {
      throw new Error(
        `Cannot rename "${existing.slug}" — it is referenced by ` +
          `${formatTemplateRefUsage(usage)}. Remove those references before ` +
          `renaming.`
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

  // Chrome assignment ("Used on" — §Part editor). The right panel submits the
  // hierarchy slugs this header/footer part should be the chrome for, plus a
  // marker so non-editor callers (which omit the field) never reconcile. We
  // reconcile by the part's own slug against its area's column; assignment is
  // per-tenant, so globals (tenantId IS NULL) and non-header/footer areas are
  // skipped. Editing the part is the only write path for ChromeAssignment.
  if (
    kind === "PART" &&
    existing.tenantId &&
    (area === "header" || area === "footer") &&
    form.get("chromeHierarchyPresent") === "1"
  ) {
    const tenantId = existing.tenantId
    const selected = form
      .getAll("chromeHierarchy")
      .filter((v): v is string => typeof v === "string")
      .filter(isHierarchySlug)

    const isHeader = area === "header"
    const setData = isHeader ? { headerSlug: slug } : { footerSlug: slug }
    const clearData = isHeader ? { headerSlug: null } : { footerSlug: null }
    const notSelected =
      selected.length > 0 ? { segment: { notIn: selected } } : {}

    await prisma.$transaction([
      // Set this part as the chrome for each selected template.
      ...selected.map((segment) =>
        prisma.chromeAssignment.upsert({
          where: { tenantId_segment: { tenantId, segment } },
          create: { tenantId, segment, ...setData },
          update: setData,
        })
      ),
      // Drop templates that pointed here but are no longer selected back to
      // the fallback chain (clear only this part's column).
      prisma.chromeAssignment.updateMany({
        where: { tenantId, ...setData, ...notSelected },
        data: clearData,
      }),
      // Tidy rows that no longer assign either a header or a footer.
      prisma.chromeAssignment.deleteMany({
        where: { tenantId, headerSlug: null, footerSlug: null },
      }),
    ])
  }
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
 * `kind` is one of LAYOUT | PATTERN | PART — each surfaced by a Library
 * sub-page (Templates / Patterns / Template Parts). A PART requires an
 * `area` and is synced by intent (schema). Slug is derived from the title
 * and de-duplicated per tenant, mirroring `createTemplateFromSelection`.
 * Redirects to the editor on success.
 */
export async function createTemplate(
  tenantId: string,
  form: FormData
): Promise<void> {
  if (!tenantId) throw new Error("Tenant is required.")

  const title = String(form.get("title") ?? "").trim()
  const kindField = String(form.get("kind") ?? "").trim()
  const areaField = String(form.get("area") ?? "").trim()

  if (!title) throw new Error("Title is required.")
  if (kindField !== "LAYOUT" && kindField !== "PATTERN" && kindField !== "PART")
    throw new Error("Kind must be LAYOUT, PATTERN, or PART.")
  const kind = kindField as "LAYOUT" | "PATTERN" | "PART"
  if (kind === "PART" && !areaField)
    throw new Error("Area is required for PART templates.")

  const baseSlug = titleToSlug(title)
  if (!baseSlug)
    throw new Error("Title must contain at least one letter or number.")
  validateSlug(baseSlug)
  // Reserved chrome slugs ("header"/"footer") are allowed only for PART —
  // authoring a Part titled "Header" is the from-scratch way to define the
  // site header (resolveChromeBySlug). A LAYOUT/PATTERN at those slugs throws.
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
    // PARTs are area-tagged and synced by intent (schema); LAYOUT/PATTERN
    // keep area null and the schema-default synced = false.
    data: {
      tenantId,
      slug,
      title,
      kind,
      ...(kind === "PART" ? { area: areaField, synced: true } : {}),
    },
    select: { id: true },
  })

  updateTag(cacheTags.template(slug))
  redirect(`/admin/templates/${created.id}/edit`)
}

/**
 * Customize a code-default site chrome part (transparent shadow — the WP
 * model). The Parts library lists "Header"/"Footer" even when no DB row
 * exists, seeded from `defaultHeader`/`defaultFooter`. Editing one calls
 * this: it materializes a tenant PART at the reserved slug, pre-filled with
 * the code default's tree, and opens the editor. From then on
 * `resolveChromeBySlug` serves this row instead of the code default; deleting
 * it ("Reset to default", via `bulkDeleteTemplates`) reverts to the code
 * default. Idempotent — if the row already exists, just opens it.
 */
export async function customizeDefaultPart(
  tenantId: string,
  slug: string
): Promise<void> {
  if (!tenantId) throw new Error("Tenant is required.")
  if (!isReservedChromeSlug(slug))
    throw new Error(`"${slug}" is not a default chrome part.`)

  // Idempotent: a concurrent create or an already-customized part just opens.
  const existing = await prisma.template.findUnique({
    where: { tenantId_slug: { tenantId, slug } },
    select: { id: true },
  })
  if (existing) redirect(`/admin/templates/${existing.id}/edit`)

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  })
  const siteName = tenant?.name ?? ""
  const project =
    slug === "header" ? defaultHeader(siteName) : defaultFooter(siteName)

  const created = await prisma.template.create({
    data: {
      tenantId,
      slug,
      title: slug === "header" ? "Header" : "Footer",
      kind: "PART",
      area: slug,
      synced: true,
      data: slimTemplateProject(project) as object,
    },
    select: { id: true },
  })

  updateTag(cacheTags.template(slug))
  redirect(`/admin/templates/${created.id}/edit`)
}

/**
 * Edit a template-hierarchy default (transparent shadow — the WP model, the
 * LAYOUT analog of `customizeDefaultPart`). The Templates library lists every
 * hierarchy type ("Pages", "Single Posts", "Page: 404", …) even when no DB
 * row exists. Editing one calls this: it materializes a tenant-scoped LAYOUT
 * at the hierarchy slug and opens the editor. Unlike the chrome parts there is
 * no code-defined body to seed from, so the row starts blank (`data = {}`,
 * which the editor opens as an empty canvas — same as `createTemplate`).
 * Idempotent: an already-materialized row just opens.
 */
export async function customizeDefaultLayout(
  tenantId: string,
  slug: string
): Promise<void> {
  if (!tenantId) throw new Error("Tenant is required.")
  const entry = getHierarchyEntry(slug)
  if (!entry) throw new Error(`"${slug}" is not a template-hierarchy default.`)

  // Idempotent: a concurrent create or an already-customized layout just opens.
  const existing = await prisma.template.findUnique({
    where: { tenantId_slug: { tenantId, slug } },
    select: { id: true },
  })
  if (existing) redirect(`/admin/templates/${existing.id}/edit`)

  const created = await prisma.template.create({
    data: {
      tenantId,
      slug,
      title: entry.title,
      kind: "LAYOUT",
      description: entry.description,
    },
    select: { id: true },
  })

  updateTag(cacheTags.template(slug))
  redirect(`/admin/templates/${created.id}/edit`)
}

/**
 * Duplicate a code-default chrome part into an independent PART — backs the
 * "Duplicate" action on the synthetic Header/Footer rows. Unlike
 * `customizeDefaultPart` (which shadows the reserved slug), this creates a
 * new part at a NON-reserved slug (`header-copy`, deduped) seeded from the
 * code default's tree, so it is a standalone part (Edit/Duplicate/Delete, no
 * Reset) rather than the site chrome. Stays on the listing — the caller
 * refreshes; no redirect.
 */
export async function duplicateDefaultPart(
  tenantId: string,
  slug: string
): Promise<void> {
  if (!tenantId) throw new Error("Tenant is required.")
  if (!isReservedChromeSlug(slug))
    throw new Error(`"${slug}" is not a default chrome part.`)

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  })
  const siteName = tenant?.name ?? ""
  const project =
    slug === "header" ? defaultHeader(siteName) : defaultFooter(siteName)

  const baseSlug = `${slug}-copy`
  let newSlug = baseSlug
  let suffix = 2
  while (
    await prisma.template.findFirst({
      where: { tenantId, slug: newSlug },
      select: { id: true },
    })
  ) {
    newSlug = `${baseSlug}-${suffix}`
    suffix++
  }

  await prisma.template.create({
    data: {
      tenantId,
      slug: newSlug,
      title: `${slug === "header" ? "Header" : "Footer"} (copy)`,
      kind: "PART",
      area: slug,
      synced: true,
      data: slimTemplateProject(project) as object,
    },
  })

  updateTag(cacheTags.template(newSlug))
}

/**
 * Duplicate a code-defined built-in pattern into an editable tenant PATTERN
 * (the WP "Duplicate" / "Copy to My Patterns" action — built-in patterns are
 * read-only, but a copy is a full user pattern). Built-in pattern *content*
 * lives in editor-only modules (it's produced by `processReactElements`, which
 * needs a live editor), so it can't be copied server-side. We instead create a
 * blank tenant PATTERN and open the editor with `?seed=<blockId>`; the shell
 * inserts that built-in block on load, capturing its content (and CSS) on the
 * first autosave. The new row is immediately a normal pattern — edit /
 * duplicate / delete all apply.
 */
export async function duplicateBuiltinPattern(
  tenantId: string,
  blockId: string
): Promise<void> {
  if (!tenantId) throw new Error("Tenant is required.")
  const descriptor = BUILTIN_PATTERNS.find((p) => p.id === blockId)
  if (!descriptor) throw new Error(`"${blockId}" is not a built-in pattern.`)

  const baseSlug = `${blockId}-copy`
  let slug = baseSlug
  let suffix = 2
  while (
    await prisma.template.findFirst({
      where: { tenantId, slug },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${suffix}`
    suffix++
  }

  const created = await prisma.template.create({
    data: {
      tenantId,
      slug,
      title: `${descriptor.label} (copy)`,
      kind: "PATTERN",
    },
    select: { id: true },
  })

  updateTag(cacheTags.template(slug))
  redirect(
    `/admin/templates/${created.id}/edit?seed=${encodeURIComponent(blockId)}`
  )
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
