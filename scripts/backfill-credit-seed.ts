/**
 * Grant the one-time 200,000-credit seed to every existing tenant.
 *
 *   pnpm seed:credits
 *
 * Idempotent — the grant posts under ledger key `seed:{tenantId}`, so tenants
 * that were already seeded are skipped by the ledger itself. Safe to re-run.
 */
import "dotenv/config"

import { asc } from "drizzle-orm"

import { seedTenantCredits } from "@/lib/billing/seed"
import { balances, UNITS_PER_CREDIT } from "@/lib/ledger"
import { db, pool } from "@/lib/db"
import { tenants as tenantsTable } from "@/lib/schema"

async function main() {
  const tenants = await db.query.tenants.findMany({
    columns: { id: true, name: true, slug: true },
    orderBy: asc(tenantsTable.createdAt),
  })
  if (tenants.length === 0) {
    console.log("no tenants found — nothing to seed")
    return
  }

  console.log(`seeding ${tenants.length} tenant(s)…\n`)
  let failures = 0
  for (const tenant of tenants) {
    try {
      await seedTenantCredits(tenant.id)
      const units = await balances.getWalletBalance(tenant.id)
      console.log(
        `  ✓ ${tenant.name} (${tenant.slug}) — balance ${units / UNITS_PER_CREDIT} credits`
      )
    } catch (e) {
      failures += 1
      console.error(
        `  ✗ ${tenant.name} (${tenant.slug}):`,
        e instanceof Error ? e.message : e
      )
    }
  }

  if (failures > 0) throw new Error(`${failures} tenant(s) failed to seed`)
  console.log("\n✅ all tenants seeded")
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(`\n❌ ${e instanceof Error ? e.message : e}`)
    await pool.end()
    process.exit(1)
  })
