import "dotenv/config"
import { defineConfig } from "drizzle-kit"

// Drizzle Kit config — schema authored by hand in lib/schema/ (see the
// migration plan: introspect is a cross-check only). Migrations emit to
// drizzle/migrations. `DATABASE_URL` is the pooled Neon endpoint; production
// DDL runs on DATABASE_URL_UNPOOLED via scripts/migrate-on-deploy.mjs.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/schema/index.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Match the existing DB: never emit DROP for objects the schema doesn't
  // model yet (e.g. the pgvector column / partial indexes carried in raw SQL).
  strict: true,
  verbose: true,
})
