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

Prisma:
- `pnpm prisma migrate dev` — apply migrations locally (reads `DATABASE_URL` from `.env` via `prisma.config.ts`)
- `pnpm prisma generate` — regenerate the client into `generated/prisma/` (this directory is git-ignored)

There is no test runner configured yet.

## Architecture

**Stack:** Next.js 16 (App Router, RSC) + React 19 + TypeScript strict + Tailwind v4 + shadcn/ui + Prisma 7 (Postgres).

**Path alias:** `@/*` resolves to the repo root (set in `tsconfig.json` and mirrored in `components.json`). Import as `@/components/...`, `@/lib/utils`, etc.

**Tailwind v4:** there is no `tailwind.config.{js,ts}`. All theme/config lives inside `app/globals.css` via `@theme` and CSS variables, processed through `@tailwindcss/postcss` (see `postcss.config.mjs`). Prettier is configured to read tokens from `app/globals.css` and to sort classes inside `cn()` and `cva()` calls.

**shadcn/ui:** configured in `components.json` with style `base-nova`, `rsc: true`, base color `neutral`, lucide icons. New components land in `components/ui/` (`pnpm dlx shadcn@latest add <name>`). The `cn()` helper in `lib/utils.ts` is the standard `clsx` + `tailwind-merge` combo that all shadcn components expect.

**Theming:** `app/layout.tsx` wraps the tree in `ThemeProvider` (`components/theme-provider.tsx`), which is `next-themes` with `attribute="class"` and a global `d`-key hotkey to toggle dark mode (suppressed when typing in inputs/contenteditable). Use `suppressHydrationWarning` on `<html>` is intentional — keep it when editing the root layout.

**Prisma:**
- Schema at `prisma/schema.prisma` uses the new `prisma-client` generator (Prisma 7), which emits to `generated/prisma/` — import the client from there, **not** from `@prisma/client`.
- Database access goes through `@prisma/adapter-pg` (driver adapter) backed by Postgres.
- Configuration is in `prisma.config.ts` (TypeScript), not in the schema's `datasource` block — `DATABASE_URL` is loaded from `.env` via `dotenv/config`. Migrations live in `prisma/migrations/`.

**Project layout intent:** `app/` for routes, `components/` for app components with `components/ui/` reserved for shadcn primitives, `lib/` for utilities, `hooks/` for React hooks. The aliases in `components.json` codify these locations for the shadcn CLI.

## Code style

- Prettier: no semicolons, double quotes, 2-space tabs, `printWidth: 80`, trailing commas `es5`. Run `pnpm format` rather than hand-formatting.
- TypeScript is strict (`strict: true`, `isolatedModules: true`). Prefer fixing types over `any`/`@ts-ignore`.
