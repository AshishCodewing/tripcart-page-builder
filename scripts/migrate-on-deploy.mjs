// Applies pending Prisma migrations — then runs idempotent data backfills —
// during a Vercel *production* build.
//
// Why this exists: the deployed app reads/writes Neon, but `prisma migrate
// dev` only ever runs against the local Postgres. Without this step the
// production schema would drift behind the committed migrations.
//
// Two deliberate choices:
//   1. Migrations run on the DIRECT (unpooled) connection. Neon's pooled
//      endpoint (PgBouncer) cannot hold the advisory locks Prisma needs, so
//      we point DATABASE_URL at DATABASE_URL_UNPOOLED for the migrate call
//      only — the app's runtime keeps using the pooled DATABASE_URL.
//   2. We only migrate when VERCEL_ENV === "production". Preview deploys
//      share the same Neon database, so running feature-branch migrations on
//      every preview would mutate production data prematurely.
//
// Data backfills run AFTER migrations, on the pooled runtime connection (no
// advisory locks needed). They are idempotent and re-runnable, so they run
// on every production deploy and are NON-FATAL — a backfill hiccup logs a
// warning but does not block the deploy.
import { execSync } from "node:child_process"

const { VERCEL_ENV, DATABASE_URL_UNPOOLED } = process.env

if (VERCEL_ENV !== "production") {
  console.log(
    `[migrate-on-deploy] skip — VERCEL_ENV=${VERCEL_ENV ?? "unset"} (runs only on production)`
  )
  process.exit(0)
}

if (!DATABASE_URL_UNPOOLED) {
  console.error(
    "[migrate-on-deploy] VERCEL_ENV=production but DATABASE_URL_UNPOOLED is unset — aborting build"
  )
  process.exit(1)
}

console.log("[migrate-on-deploy] applying migrations on the direct connection…")
execSync("prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: DATABASE_URL_UNPOOLED },
})

// Idempotent data backfills. Run on the pooled runtime connection (default
// env) since they issue ordinary queries, not lock-holding DDL. Kept
// non-fatal — each is re-runnable and skips already-migrated rows.
const backfills = [
  {
    label: "tenant theme block-gap",
    cmd: "pnpm exec tsx scripts/backfill-block-gap.ts",
  },
]

for (const { label, cmd } of backfills) {
  console.log(`[migrate-on-deploy] backfill: ${label} (idempotent)…`)
  try {
    execSync(cmd, { stdio: "inherit", env: process.env })
  } catch (e) {
    console.warn(
      `[migrate-on-deploy] backfill "${label}" failed (non-fatal): ${
        e instanceof Error ? e.message : e
      }`
    )
  }
}
