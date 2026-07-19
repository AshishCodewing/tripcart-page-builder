import { createId } from "@paralleldrive/cuid2"
import { randomUUID } from "node:crypto"
import { timestamp } from "drizzle-orm/pg-core"

// ── ID generation ──────────────────────────────────────────────────────────
// The DB `id` columns are plain TEXT with NO database default — Prisma always
// generated ids client-side (`@default(cuid())` / `@default(uuid())`). Drizzle
// mirrors that with `$defaultFn`; no `.default()` is emitted, so these do not
// affect the generated DDL / baseline diff. No code parses id format, so cuid2
// is a safe successor to Prisma's cuid v1 (verified before choosing it).
export const cuid = () => createId()
export const uuid = () => randomUUID()

// ── Timestamp columns ────────────────────────────────────────────────────────
// All DB timestamps are `TIMESTAMP(3) WITHOUT TIME ZONE`. `createdAt` carries a
// `DEFAULT CURRENT_TIMESTAMP`; `updatedAt` has NO default (Prisma's `@updatedAt`
// wrote it from the client), so we set it via `$onUpdate` and on insert.
export const createdAt = () => timestampNow("createdAt")

// A `TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` column under a given name
// (createdAt, lastSeenAt, …).
export const timestampNow = (name: string) =>
  timestamp(name, { precision: 3, mode: "date" }).notNull().defaultNow()

export const updatedAt = () =>
  timestamp("updatedAt", { precision: 3, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
