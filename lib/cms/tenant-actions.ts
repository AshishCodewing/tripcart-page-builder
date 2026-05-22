"use server"

import { updateTag } from "next/cache"
import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { themeSchema } from "@/lib/theme/schema.zod"
import type { Theme } from "@/lib/theme/schema"

import { cacheTags } from "./cache-tags"
import { validateSlug } from "./path"

export async function createTenant(form: FormData): Promise<void> {
  const name = String(form.get("name") ?? "").trim()
  const slug = String(form.get("slug") ?? "").trim()
  const domainRaw = String(form.get("domain") ?? "").trim()
  const domain = domainRaw.length ? domainRaw.toLowerCase() : null

  if (!name) throw new Error("Name is required.")
  validateSlug(slug)

  const existingSlug = await prisma.tenant.findUnique({ where: { slug } })
  if (existingSlug)
    throw new Error(`A tenant with slug "${slug}" already exists.`)

  if (domain) {
    const existingDomain = await prisma.tenant.findUnique({ where: { domain } })
    if (existingDomain)
      throw new Error(`A tenant with domain "${domain}" already exists.`)
  }

  await prisma.tenant.create({ data: { name, slug, domain } })

  updateTag(cacheTags.tenants)
  redirect("/admin/tenants")
}

export async function updateTenant(id: string, form: FormData): Promise<void> {
  const existing = await prisma.tenant.findUnique({ where: { id } })
  if (!existing) throw new Error("Tenant not found.")

  const name = String(form.get("name") ?? existing.name).trim()
  const slug = String(form.get("slug") ?? existing.slug).trim()
  const domainRaw = String(form.get("domain") ?? "").trim()
  const domain = domainRaw.length ? domainRaw.toLowerCase() : null

  if (!name) throw new Error("Name is required.")
  validateSlug(slug)

  if (slug !== existing.slug) {
    const clash = await prisma.tenant.findUnique({ where: { slug } })
    if (clash) throw new Error(`A tenant with slug "${slug}" already exists.`)
  }

  if (domain && domain !== existing.domain) {
    const clash = await prisma.tenant.findUnique({ where: { domain } })
    if (clash)
      throw new Error(`A tenant with domain "${domain}" already exists.`)
  }

  await prisma.tenant.update({
    where: { id },
    data: { name, slug, domain },
  })

  updateTag(cacheTags.tenants)
}

export async function deleteTenant(id: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { id } })
  if (!tenant) return
  await prisma.tenant.delete({ where: { id } })
  updateTag(cacheTags.tenants)
  redirect("/admin/tenants")
}

/**
 * Persist a full `Theme` document onto a tenant.
 *
 * The payload is parsed through `themeSchema` first — malformed input
 * throws rather than silently corrupting the DB row. Callers should
 * surface the error to the user. Cache invalidation bumps the
 * tenant-scoped theme tag (consumed by any cached fetch path that
 * loads the tenant theme) and the broad `nav` tag (since published
 * pages' rendered HTML embeds theme variables).
 */
export async function updateTenantTheme(
  tenantId: string,
  theme: Theme
): Promise<void> {
  const parsed = themeSchema.safeParse(theme)
  if (!parsed.success) {
    throw new Error(`Invalid theme payload: ${parsed.error.message}`)
  }

  const existing = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  })
  if (!existing) throw new Error(`Tenant ${tenantId} not found.`)

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { theme: parsed.data },
  })

  updateTag(cacheTags.tenantTheme(tenantId))
  updateTag(cacheTags.nav)
}
