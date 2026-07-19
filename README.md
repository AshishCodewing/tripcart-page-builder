# TripCart Page Builder

A multi-tenant CMS and visual page builder. Tenants author pages, posts,
and reusable templates in a GrapesJS drag-and-drop editor; content is
stored as project JSON in Postgres and rendered to HTML through a custom
React renderer for previews. Each tenant carries its own theme — a
WordPress-`theme.json`-inspired token registry and style defaults that
compile to scoped CSS variables — and a template library of layouts,
patterns, and parts.

## Stack

- **Next.js 16** (App Router, RSC) + **React 19** + **TypeScript** (strict)
- **Tailwind v4** + **shadcn/ui** (theme config lives in `app/globals.css`)
- **Drizzle ORM** + **Postgres** (`pg` driver; hand-written schema in
  `lib/schema/`, client in `lib/db.ts`)
- **GrapesJS** for the canvas, with custom plugins (React renderer, theme
  design system, template refs, patterns)
- Package manager: **pnpm**

## Getting started

```sh
cp .env.example .env        # fill in DATABASE_URL
pnpm install
pnpm db:migrate             # apply migrations locally
pnpm dev                    # Next.js dev server (Turbopack)
```

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | dev server with Turbopack |
| `pnpm build` | production build |
| `pnpm test` / `pnpm test:watch` | Vitest suite |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm format` | Prettier across `**/*.{ts,tsx}` |

CI (`.github/workflows/ci.yml`) gates pushes to `main` and all PRs on
typecheck + lint + test.

The `ingest:*` and `mcp:rag` scripts belong to a dev-time documentation-RAG
side project (searching GrapesJS/WordPress docs from an MCP server) — see
`docs/rag-decoupling-decision.md`.

## Where things live

- `app/` — routes (admin shell, editor, preview, API)
- `components/` — app components; `components/ui/` is reserved for
  shadcn primitives
- `lib/cms/` — server actions, persistence, path/slug logic, payload
  validation
- `lib/plugins/` — GrapesJS plugins, including the React renderer
  (canvas + project halves)
- `lib/theme/` — theme schema (Zod is the single source of truth),
  compiler, presets
- `lib/schema/` — hand-written Drizzle schema; `lib/db.ts` — DB client
- `drizzle/` — generated SQL migrations (`prisma/migrations/` kept as history)
- `docs/` — design docs (`docs/handbook/` for subsystem deep-dives,
  `docs/reference/` for pinned technical references)

Architecture details and conventions: see `CLAUDE.md`; design docs in
`docs/`.
