"use server"

import { updateTag } from "next/cache"

import { prisma } from "@/lib/prisma"

import { cacheTags } from "./cache-tags"

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

  // The editor shell injects this on submit (see augmentedSave in
  // editor-shell). Non-editor callers will omit it, in which case we
  // preserve the existing tree.
  const dataField = form.get("data")
  let data: unknown = undefined
  if (typeof dataField === "string" && dataField.length) {
    try {
      data = JSON.parse(dataField)
    } catch {
      throw new Error("Invalid template payload — could not parse JSON.")
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
      ...(data !== undefined ? { data: data as object } : {}),
    },
  })

  updateTag(cacheTags.template(existing.slug))
}
