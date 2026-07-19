"use server"

import { updateTag } from "next/cache"
import { redirect } from "next/navigation"

import { eq, sql } from "drizzle-orm"

import { seedTenantCredits } from "@/lib/billing/seed"
import { db } from "@/lib/db"
import { tenants } from "@/lib/schema"
import { cssContentKey } from "@/lib/plugins/react-renderer/project/css-helpers"
import { compiledThemeToCss, compileTheme } from "@/lib/theme/compile"
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

  const existingSlug = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  })
  if (existingSlug)
    throw new Error(`A tenant with slug "${slug}" already exists.`)

  if (domain) {
    const existingDomain = await db.query.tenants.findFirst({
      where: eq(tenants.domain, domain),
    })
    if (existingDomain)
      throw new Error(`A tenant with domain "${domain}" already exists.`)
  }

  const [tenant] = await db
    .insert(tenants)
    .values({ name, slug, domain })
    .returning({ id: tenants.id })

  // Best-effort: the billing gate re-seeds a missing wallet on first use.
  try {
    await seedTenantCredits(tenant.id)
  } catch (e) {
    console.error(`failed to seed credits for tenant ${tenant.id}:`, e)
  }

  updateTag(cacheTags.tenants)
  redirect("/admin/tenants")
}

export async function updateTenant(id: string, form: FormData): Promise<void> {
  const existing = await db.query.tenants.findFirst({ where: eq(tenants.id, id) })
  if (!existing) throw new Error("Tenant not found.")

  const name = String(form.get("name") ?? existing.name).trim()
  const slug = String(form.get("slug") ?? existing.slug).trim()
  const domainRaw = String(form.get("domain") ?? "").trim()
  const domain = domainRaw.length ? domainRaw.toLowerCase() : null

  if (!name) throw new Error("Name is required.")
  validateSlug(slug)

  if (slug !== existing.slug) {
    const clash = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
    })
    if (clash) throw new Error(`A tenant with slug "${slug}" already exists.`)
  }

  if (domain && domain !== existing.domain) {
    const clash = await db.query.tenants.findFirst({
      where: eq(tenants.domain, domain),
    })
    if (clash)
      throw new Error(`A tenant with domain "${domain}" already exists.`)
  }

  await db.update(tenants).set({ name, slug, domain }).where(eq(tenants.id, id))

  updateTag(cacheTags.tenants)
}

export async function deleteTenant(id: string): Promise<void> {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, id) })
  if (!tenant) return
  await db.delete(tenants).where(eq(tenants.id, id))
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

  const existing = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { id: true },
  })
  if (!existing) throw new Error(`Tenant ${tenantId} not found.`)

  // Bake the compiled CSS alongside the source document so a read-only
  // renderer can serve a string without importing compileTheme. The
  // preview theme route still compiles on demand — this bake is the
  // artifact-pipeline mirror of Page/Post/Template `css` (plan 023).
  const themeCss = compiledThemeToCss(compileTheme(parsed.data))

  await db
    .update(tenants)
    .set({
      theme: parsed.data,
      // Bump the version so the compiled-theme CSS URL changes. The
      // route handler serves the current theme for any URL; the version
      // exists only to invalidate browser/CDN caches by URL rotation.
      themeVersion: sql`${tenants.themeVersion} + 1`,
      themeCss,
      themeCssHash: cssContentKey(themeCss),
    })
    .where(eq(tenants.id, tenantId))

  updateTag(cacheTags.tenantTheme(tenantId))
  updateTag(cacheTags.nav)
}
