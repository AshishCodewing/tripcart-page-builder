import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "@/lib/schema"

// Drizzle client singleton. Mirrors the old lib/prisma.ts pattern: a single
// pg Pool + Drizzle instance, cached on globalThis in development so Next.js
// HMR doesn't leak a new pool on every reload. Runtime uses the pooled
// DATABASE_URL (Neon PgBouncer); migrations use DATABASE_URL_UNPOOLED.
const globalForDb = globalThis as unknown as {
  pool?: Pool
  db?: ReturnType<typeof createDb>
}

function createPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL })
}

function createDb(pool: Pool) {
  return drizzle(pool, { schema })
}

export const pool = globalForDb.pool ?? createPool()
export const db = globalForDb.db ?? createDb(pool)

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool
  globalForDb.db = db
}

// The Drizzle database handle and its transaction handle. Repositories/helpers
// that must run inside a caller's transaction accept `Database | Transaction`
// (both expose the same query builder), mirroring Prisma's TransactionClient.
export type Database = typeof db
export type Transaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0]
export type Db = Database | Transaction
