/**
 * Backfill the root `styles.spacing.blockGap` token on tenant themes that
 * predate the block-gap vertical-rhythm wiring.
 *
 *   pnpm backfill:block-gap
 *
 * Context: `compileTheme` now hoists root `blockGap` to the
 * `--tc--style--block-gap` custom property consumed by the
 * `.tc-entry-content` flow owl in tc-normalize.css. `defaultTheme` sets it,
 * so freshly-seeded tenants get it automatically — but tenants whose theme
 * was stored before this landed carry no `blockGap` and fall back to the
 * tc-normalize default. This gives them the token-driven value instead.
 *
 * Idempotent — skips tenants that already have `styles.spacing.blockGap`,
 * and skips empty-theme tenants (they resolve to `defaultTheme`, which
 * already has it). For each updated tenant it recompiles + rebakes
 * `themeCss`/`themeCssHash` and bumps `themeVersion` so the immutable
 * preview theme.css URL rotates and caches don't serve stale CSS. Safe to
 * re-run. Mirrors the write in `updateTenantTheme` (minus the request-scoped
 * cache-tag invalidation, which the version bump makes unnecessary here).
 */
import "dotenv/config"

import { eq, sql } from "drizzle-orm"

import { cssContentKey } from "@/lib/plugins/react-renderer/project/css-helpers"
import { db, pool } from "@/lib/db"
import { tenants as tenantsTable } from "@/lib/schema"
import { compiledThemeToCss, compileTheme } from "@/lib/theme/compile"
import type { Theme } from "@/lib/theme/schema"
import { themeSchema } from "@/lib/theme/schema.zod"

// Matches `defaultTheme.styles.spacing.blockGap` (lib/tokens/index.ts).
const BLOCK_GAP_REF = "var:preset|spacing|lg"

async function main() {
  console.log("backfilling tenant theme block-gap…\n")

  const tenants = await db.query.tenants.findMany({
    columns: { id: true, slug: true, theme: true },
  })

  let updated = 0
  let skipped = 0
  let failures = 0

  for (const tenant of tenants) {
    const stored = tenant.theme
    const isEmpty =
      stored == null ||
      (typeof stored === "object" && Object.keys(stored).length === 0)

    // Empty theme → resolves to defaultTheme, which already carries the
    // token. Nothing stored to migrate.
    if (isEmpty) {
      skipped += 1
      continue
    }

    const theme = stored as unknown as Theme
    if (theme.styles?.spacing?.blockGap) {
      skipped += 1
      continue
    }

    try {
      const next: Theme = {
        ...theme,
        styles: {
          ...theme.styles,
          spacing: { ...theme.styles?.spacing, blockGap: BLOCK_GAP_REF },
        },
      }

      const parsed = themeSchema.safeParse(next)
      if (!parsed.success) {
        throw new Error(`invalid theme after merge: ${parsed.error.message}`)
      }

      const themeCss = compiledThemeToCss(compileTheme(parsed.data))
      await db
        .update(tenantsTable)
        .set({
          theme: parsed.data,
          themeVersion: sql`${tenantsTable.themeVersion} + 1`,
          themeCss,
          themeCssHash: cssContentKey(themeCss),
        })
        .where(eq(tenantsTable.id, tenant.id))
      updated += 1
      console.log(`  ✓ ${tenant.slug}`)
    } catch (e) {
      failures += 1
      console.error(
        `  ✗ tenant ${tenant.slug}:`,
        e instanceof Error ? e.message : e
      )
    }
  }

  console.log(
    `\n  updated ${updated}, skipped ${skipped}, failed ${failures} (of ${tenants.length})`
  )
  if (failures > 0) throw new Error(`${failures} tenant(s) failed to backfill`)
  console.log("✅ block-gap backfill complete")
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(`\n❌ ${e instanceof Error ? e.message : e}`)
    await pool.end()
    process.exit(1)
  })
