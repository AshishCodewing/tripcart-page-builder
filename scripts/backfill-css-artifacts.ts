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

import { eq, isNull } from "drizzle-orm"

import { compileCssArtifact } from "@/lib/cms/css-artifacts"
import { cssContentKey } from "@/lib/plugins/react-renderer/project/css-helpers"
import { db, pool } from "@/lib/db"
import { pages, posts, templates, tenants } from "@/lib/schema"
import { compiledThemeToCss, compileTheme } from "@/lib/theme/compile"
import type { Theme } from "@/lib/theme/schema"
import { defaultTheme } from "@/lib/tokens"

type ContentDelegate = "page" | "post" | "template"

// The three content tables share the columns we touch (id, data, css, cssHash).
const CONTENT_TABLES = { page: pages, post: posts, template: templates } as const

async function backfillContent(kind: ContentDelegate): Promise<number> {
  const table = CONTENT_TABLES[kind]
  const rows = await db
    .select({ id: table.id, data: table.data })
    .from(table)
    .where(isNull(table.css))

  let failures = 0
  for (const row of rows) {
    try {
      const artifact = compileCssArtifact((row.data ?? {}) as object)
      await db.update(table).set(artifact).where(eq(table.id, row.id))
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
  const tenantRows = await db.query.tenants.findMany({
    where: isNull(tenants.themeCss),
    columns: { id: true, slug: true, theme: true },
  })

  let failures = 0
  for (const tenant of tenantRows) {
    try {
      // Mirror getTenantTheme's sentinel: `{}` means "use the bundled
      // defaultTheme" — never feed the raw empty object to compileTheme.
      const stored = tenant.theme
      const isEmpty =
        stored == null ||
        (typeof stored === "object" && Object.keys(stored).length === 0)
      const theme = isEmpty ? defaultTheme : (stored as unknown as Theme)

      const themeCss = compiledThemeToCss(compileTheme(theme))
      await db
        .update(tenants)
        .set({ themeCss, themeCssHash: cssContentKey(themeCss) })
        .where(eq(tenants.id, tenant.id))
    } catch (e) {
      failures += 1
      console.error(
        `  ✗ tenant ${tenant.slug}:`,
        e instanceof Error ? e.message : e
      )
    }
  }
  console.log(
    `  ✓ tenant themes: ${tenantRows.length - failures}/${tenantRows.length} baked`
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
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(`\n❌ ${e instanceof Error ? e.message : e}`)
    await pool.end()
    process.exit(1)
  })
