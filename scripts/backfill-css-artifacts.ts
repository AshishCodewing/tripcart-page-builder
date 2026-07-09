/**
 * Bake missing CSS artifacts for rows that predate the pipeline (plan 023).
 *
 *   pnpm backfill:css
 *
 * Idempotent — only touches rows whose artifact column is null (`css` on
 * pages/posts/templates, `themeCss` on tenants); rows written through the
 * save actions since the pipeline landed already carry an artifact and are
 * skipped. Safe to re-run.
 */
import "dotenv/config"

import { compileCssArtifact } from "@/lib/cms/css-artifacts"
import { cssContentKey } from "@/lib/plugins/react-renderer/project/css-helpers"
import { prisma } from "@/lib/prisma"
import { compiledThemeToCss, compileTheme } from "@/lib/theme/compile"
import type { Theme } from "@/lib/theme/schema"
import { defaultTheme } from "@/lib/tokens"

type ContentDelegate = "page" | "post" | "template"

async function backfillContent(kind: ContentDelegate): Promise<number> {
  const delegate =
    kind === "page"
      ? prisma.page
      : kind === "post"
        ? prisma.post
        : prisma.template
  // The three delegates share the fields we touch; TS can't unify their
  // generated types, so go through the narrow shape we actually use.
  const rows: { id: string; data: unknown }[] = await (
    delegate.findMany as (
      args: object
    ) => Promise<{ id: string; data: unknown }[]>
  )({ where: { css: null }, select: { id: true, data: true } })

  let failures = 0
  for (const row of rows) {
    try {
      const artifact = compileCssArtifact((row.data ?? {}) as object)
      await (delegate.update as (args: object) => Promise<unknown>)({
        where: { id: row.id },
        data: artifact,
      })
    } catch (e) {
      failures += 1
      console.error(
        `  ✗ ${kind} ${row.id}:`,
        e instanceof Error ? e.message : e
      )
    }
  }
  console.log(`  ✓ ${kind}s: ${rows.length - failures}/${rows.length} baked`)
  return failures
}

async function backfillTenantThemes(): Promise<number> {
  const tenants = await prisma.tenant.findMany({
    where: { themeCss: null },
    select: { id: true, slug: true, theme: true },
  })

  let failures = 0
  for (const tenant of tenants) {
    try {
      // Mirror getTenantTheme's sentinel: `{}` means "use the bundled
      // defaultTheme" — never feed the raw empty object to compileTheme.
      const stored = tenant.theme
      const isEmpty =
        stored == null ||
        (typeof stored === "object" && Object.keys(stored).length === 0)
      const theme = isEmpty ? defaultTheme : (stored as unknown as Theme)

      const themeCss = compiledThemeToCss(compileTheme(theme))
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { themeCss, themeCssHash: cssContentKey(themeCss) },
      })
    } catch (e) {
      failures += 1
      console.error(
        `  ✗ tenant ${tenant.slug}:`,
        e instanceof Error ? e.message : e
      )
    }
  }
  console.log(
    `  ✓ tenant themes: ${tenants.length - failures}/${tenants.length} baked`
  )
  return failures
}

async function main() {
  console.log("backfilling css artifacts…\n")
  let failures = 0
  failures += await backfillContent("page")
  failures += await backfillContent("post")
  failures += await backfillContent("template")
  failures += await backfillTenantThemes()

  if (failures > 0) throw new Error(`${failures} row(s) failed to backfill`)
  console.log("\n✅ all artifacts baked")
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(`\n❌ ${e instanceof Error ? e.message : e}`)
    await prisma.$disconnect()
    process.exit(1)
  })
