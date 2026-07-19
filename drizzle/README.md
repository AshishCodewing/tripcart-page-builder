# Drizzle migrations

The schema is **hand-written** in `lib/schema/` (see the Prisma→Drizzle
migration plan). `drizzle-kit introspect` is intentionally NOT the source of
truth — it mis-infers nullability/types and doesn't know Prisma's history.

## Baseline

`0000_baseline.sql` is a full `CREATE` of the schema as it existed under Prisma.
The database **already contains** these objects (Prisma built them), so the
baseline must never be executed. Instead it is recorded as already-applied via:

```
node scripts/drizzle-baseline.mjs
```

This seeds `drizzle.__drizzle_migrations` with the baseline's hash so
`drizzle-kit migrate` skips it and only ever runs migrations authored *after*
the baseline. **Run this once per environment** (local dev DB — already done;
production Neon — run against `DATABASE_URL_UNPOOLED` before the first
Drizzle-managed deploy). It is idempotent.

## Forward workflow

- Edit `lib/schema/*.ts`.
- `pnpm db:generate` — emit a new `NNNN_*.sql` diff (review it).
- `pnpm db:migrate` — apply pending migrations (prod runs this on the unpooled
  URL via `scripts/migrate-on-deploy.mjs`).

## Known cosmetic differences vs the live DB (harmless)

Because the schema was hand-written rather than introspected, drizzle-kit's
internal snapshot names two things differently from the Prisma-built DB. Neither
affects runtime queries or the forward `generate`/`migrate` workflow (which
diffs schema-vs-snapshot, never re-introspects the DB):

- **FK constraint names** — Drizzle assumes `<table>_<col>_<reftable>_<refcol>_fk`;
  the DB has Prisma's `<table>_<col>_fkey`. FK names are never referenced in
  queries. Only relevant if a future migration tries to DROP a FK by drizzle's
  assumed name — author such a drop with the real `_fkey` name.
- **Timestamp default** — schema emits `DEFAULT now()`; the DB stores the
  equivalent `CURRENT_TIMESTAMP`.

The `vector(3072)` column and both partial unique indexes
(`WHERE "tenantId" IS NULL`) DO match exactly.
