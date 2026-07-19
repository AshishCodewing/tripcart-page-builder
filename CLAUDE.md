# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (pnpm-lock.yaml is the source of truth).

- `pnpm dev` — Next.js dev server with Turbopack
- `pnpm build` — production build
- `pnpm start` — run the built app
- `pnpm lint` — ESLint (uses flat config in `eslint.config.mjs`, extending `eslint-config-next`)
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm format` — Prettier write across `**/*.{ts,tsx}`

Drizzle (ORM):
- `pnpm db:generate` — generate a new SQL migration from `lib/schema/` changes into `drizzle/migrations/`
- `pnpm db:migrate` — apply pending migrations (reads `DATABASE_URL` from `.env` via `drizzle.config.ts`)
- `pnpm db:baseline` — one-time-per-environment: record the baseline migration as already-applied for an existing (Prisma-built) DB without re-creating it (see `drizzle/README.md`)

Testing uses **Vitest**: `pnpm test` (pure unit suite, no DB), `pnpm test:integration` (Postgres-backed, e.g. the ledger — needs `DATABASE_URL`).

## Architecture

**Stack:** Next.js 16 (App Router, RSC) + React 19 + TypeScript strict + Tailwind v4 + shadcn/ui + Drizzle ORM (Postgres).

**Path alias:** `@/*` resolves to the repo root (set in `tsconfig.json` and mirrored in `components.json`). Import as `@/components/...`, `@/lib/utils`, etc.

**Tailwind v4:** there is no `tailwind.config.{js,ts}`. All theme/config lives inside `app/globals.css` via `@theme` and CSS variables, processed through `@tailwindcss/postcss` (see `postcss.config.mjs`). Prettier is configured to read tokens from `app/globals.css` and to sort classes inside `cn()` and `cva()` calls.

**shadcn/ui:** configured in `components.json` with style `base-nova`, `rsc: true`, base color `neutral`, lucide icons. New components land in `components/ui/` (`pnpm dlx shadcn@latest add <name>`). The `cn()` helper in `lib/utils.ts` is the standard `clsx` + `tailwind-merge` combo that all shadcn components expect.

**Theming:** `app/layout.tsx` wraps the tree in `ThemeProvider` (`components/theme-provider.tsx`), which is `next-themes` with `attribute="class"` and a global `d`-key hotkey to toggle dark mode (suppressed when typing in inputs/contenteditable). Use `suppressHydrationWarning` on `<html>` is intentional — keep it when editing the root layout.

**Drizzle:**
- Schema is hand-written in `lib/schema/` (`cms.ts`, `ledger.ts`, `rag.ts`, re-exported from `index.ts`) — the source of truth, NOT introspection. Import tables and inferred types (`typeof x.$inferSelect`) from `@/lib/schema`.
- The client singleton is `lib/db.ts` — a `pg` `Pool` + `drizzle(pool, { schema })`, cached on `globalThis` in dev. Import `{ db }` from `@/lib/db`; it exposes the query builder and the relational API (`db.query.*`). `Database`/`Transaction`/`Db` types are exported there too.
- Configuration is in `drizzle.config.ts` — `DATABASE_URL` loaded from `.env` via `dotenv/config`. Migrations live in `drizzle/migrations/` (see `drizzle/README.md` for the baseline + forward-diff workflow). `prisma/migrations/` is retained only as a historical record.
- pgvector: `DocChunk.embedding` (`vector(3072)`) is only ever touched via raw `sql` in `lib/rag/store.ts` (cosine `<=>` search), never the typed API. Array membership uses `inArray()` — a JS array embedded in a raw `sql` template expands to a tuple, so `= ANY(...::text[])` does NOT work.
- Unique-violation handling: catch pg error code `23505` via `isUniqueViolation()` (`lib/ledger/pg-error.ts`), which unwraps Drizzle's `DrizzleQueryError.cause` — the replacement for Prisma's `P2002`.

**Project layout intent:** `app/` for routes, `components/` for app components with `components/ui/` reserved for shadcn primitives, `lib/` for utilities, `hooks/` for React hooks. The aliases in `components.json` codify these locations for the shadcn CLI.

## Code style

- Prettier: no semicolons, double quotes, 2-space tabs, `printWidth: 80`, trailing commas `es5`. Run `pnpm format` rather than hand-formatting.
- TypeScript is strict (`strict: true`, `isolatedModules: true`). Prefer fixing types over `any`/`@ts-ignore`.
