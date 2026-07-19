// One-time baseline for an EXISTING database that was built by Prisma.
//
// The Drizzle schema (lib/schema/) was hand-written to reproduce the current
// DB exactly, and `drizzle-kit generate` emitted 0000_baseline.sql — a full
// CREATE of every table/index/constraint. Those objects ALREADY exist in the
// database (Prisma created them), so we must NOT run that SQL. Instead we seed
// Drizzle's bookkeeping table (`drizzle.__drizzle_migrations`) with the
// baseline's hash so `drizzle-kit migrate` treats it as already applied and
// only ever runs migrations authored AFTER the baseline.
//
// Run once per environment (local dev DB, then production Neon) right after
// switching to Drizzle:  node scripts/drizzle-baseline.mjs
// Idempotent: does nothing if the baseline hash is already recorded.
import "dotenv/config"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { Client } from "pg"

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, "..", "drizzle", "migrations")

// The baseline is the FIRST journal entry — the snapshot of the pre-Drizzle DB.
// Later entries are real forward migrations and must NOT be pre-seeded here.
const journal = JSON.parse(
  readFileSync(join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8")
)
const baseline = journal.entries.find((e) => e.idx === 0)
if (!baseline) {
  console.error("[drizzle-baseline] no idx:0 entry in _journal.json")
  process.exit(1)
}

const sqlPath = join(MIGRATIONS_DIR, `${baseline.tag}.sql`)
const sql = readFileSync(sqlPath, "utf8")
const hash = createHash("sha256").update(sql).digest("hex")

const url = process.env.DATABASE_URL
if (!url) {
  console.error("[drizzle-baseline] DATABASE_URL is unset")
  process.exit(1)
}

const client = new Client({ connectionString: url })
await client.connect()
try {
  // Same DDL the drizzle migrator uses for its bookkeeping table.
  await client.query(`CREATE SCHEMA IF NOT EXISTS "drizzle"`)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )`)

  const { rows } = await client.query(
    `SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = $1 LIMIT 1`,
    [hash]
  )
  if (rows.length > 0) {
    console.log(
      `[drizzle-baseline] baseline ${baseline.tag} already recorded — nothing to do`
    )
    process.exit(0)
  }

  await client.query(
    `INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)`,
    [hash, baseline.when]
  )
  console.log(
    `[drizzle-baseline] recorded ${baseline.tag} (hash ${hash.slice(0, 12)}…) as applied — DB left untouched`
  )
} finally {
  await client.end()
}
