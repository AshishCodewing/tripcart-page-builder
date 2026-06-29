# Plan 006: Decide the fate of the embedded RAG side-project (investigate → recommend)

> **Executor instructions**: This is an INVESTIGATION plan — you produce a
> decision memo, not code changes. You may not modify any source file; your
> only writable outputs are the memo at `docs/rag-decoupling-decision.md`
> and the status row in `plans/README.md`. Run every verification command
> read-only. If anything in the "STOP conditions" section occurs, stop and
> report.
>
> **Drift check (run first)**: `git diff --stat ae527df..HEAD -- lib/rag scripts prisma/schema.prisma package.json`
> Drift here is fine (this is an inventory task) — just inventory the
> current state, not the excerpts below.

## Status

- **Priority**: P3
- **Effort**: M (investigation)
- **Risk**: LOW (no code changes in this plan)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `ae527df`, 2026-06-11

## Why this matters

A documentation-RAG side project (used during development to search GrapesJS
/ WordPress docs from an MCP server) lives inside the production app repo
and is coupled to it in four ways:

1. **Schema**: `DocChunk` / `DocChunkUrl` models in `prisma/schema.prisma`
   (lines ~192-219) plus `extensions = [vector]` on the datasource — the
   production Postgres must have pgvector for migrations to apply, because…
2. **Deploy**: `prebuild` runs `scripts/migrate-on-deploy.mjs` on every
   production build, applying ALL migrations including RAG ones.
3. **Dependencies**: `@langchain/core`, `@langchain/google-genai`,
   `@langchain/textsplitters`, `@google/generative-ai`,
   `@modelcontextprotocol/sdk`, `cheerio`, `turndown`,
   `@joplin/turndown-plugin-gfm`, `gpt-tokenizer`, `p-queue` are in
   `dependencies` (not devDependencies), and `@modelcontextprotocol/sdk`
   pulls `hono`, which currently shows up in `pnpm audit --prod` findings —
   audit noise charged to the production app for a dev-time tool.
4. **Code**: `lib/rag/` (7 files), `scripts/ingest-*` (5 scripts),
   `scripts/mcp-rag-server.ts`, plus the `ingest:*` / `mcp:rag` package
   scripts.

Nothing in the running app appears to import `lib/rag/` — but that needs
confirming, which is part of this investigation. The cost of doing nothing
is recurring: every prod deploy carries the coupling, every audit carries
the noise, and the pgvector requirement constrains DB hosting choices.

## Current state (verified facts to build on)

- `prisma/schema.prisma` datasource: `extensions = [vector]`;
  `DocChunk.embedding Unsupported("vector(3072)")`.
- `.env.example` documents `GOOGLE_API_KEY` (embeddings) and
  `ANTHROPIC_API_KEY` as RAG-related.
- `.mcp.json` at repo root wires the MCP RAG server into the maintainer's
  editor sessions (this is the active consumer).
- Git churn: `lib/rag/` has ~4 commits total vs 20+ in `lib/cms/` — dormant
  but not abandoned (the maintainer's notes reference recent ingests, e.g.
  WP Themes Handbook ingested 2026-06).

## Commands you will need (all read-only)

| Purpose | Command | Expected |
|---|---|---|
| App-code imports of rag | `grep -rn "lib/rag\|@/lib/rag" app components lib hooks --include="*.ts" --include="*.tsx" \| grep -v "^lib/rag"` | expected: empty |
| Scripts' imports | `grep -rln "lib/rag" scripts` | the ingest/mcp scripts only |
| Dep usage map | `grep -rln "<dep-name>" app components lib hooks scripts` per dep in the list above | which deps are rag-only |
| Audit attribution | `pnpm audit --prod` | which findings trace to rag-only deps |
| Migration inventory | `ls prisma/migrations \| grep -i "doc\|chunk\|vector"` + read those SQL files | which migrations are rag-only |
| Typecheck (baseline) | `pnpm typecheck` | exit 0 |

## Scope

**In scope (writable)**:
- `docs/rag-decoupling-decision.md` (create — the memo)
- `plans/README.md` (status row)

**Out of scope (read-only / forbidden)**:
- ALL source files, `package.json`, `prisma/schema.prisma`, migrations.
- Do NOT run any ingest script, the MCP server, or anything that touches
  the database or external APIs.

## Steps

### Step 1: Confirm the isolation boundary

Run the import greps. Record: (a) does any app-runtime module import
`lib/rag`? (b) does `lib/rag` import anything from `lib/cms`/`app`? (c) the
exact list of rag-only dependencies (a dep is rag-only iff its only
importers are `lib/rag/**` or `scripts/**`).

**Verify**: each grep documented in the memo with its literal output summary.

### Step 2: Quantify the coupling cost

- List the rag-only migrations and what they create.
- Attribute `pnpm audit --prod` findings: which trace to rag-only deps.
- Estimate install weight: `du -sh node_modules/@langchain node_modules/cheerio` etc. (approximate is fine).
- Note the pgvector hosting constraint and whether the current production DB
  already has it enabled (infer from migration history having applied —
  do not connect to prod).

### Step 3: Write the decision memo

`docs/rag-decoupling-decision.md` with exactly these sections:

1. **Findings** — the evidence from steps 1–2.
2. **Options**, each with concrete effort and what changes:
   - **(a) Extract to a sibling repo/workspace**: move `lib/rag` +
     `scripts/ingest-*` + `scripts/mcp-rag-server.ts` + rag deps to a new
     package with its own `prisma/schema.prisma` (same DATABASE_URL or a
     dedicated DB), its own migration history for Doc* tables, and the
     `.mcp.json` pointing at the new location. Main-app schema drops the
     Doc* models + vector extension **only if** the prod DB story for the
     existing tables is resolved (dropping models without dropping tables
     leaves orphans; dropping tables loses the ingested corpus — needs the
     maintainer's call).
   - **(b) Keep in-repo, isolate the blast radius**: move rag-only deps to
     `devDependencies` (they're never bundled by Next if unimported — verify
     with the Step 1 grep), keep schema as-is, accept pgvector. Cheapest;
     fixes the audit noise and prod `node_modules` weight only.
   - **(c) Delete**: remove code + deps + models; write a down-migration
     dropping the tables. Only if the maintainer no longer uses the MCP
     server (evidence says they do — flag this).
3. **Recommendation** — pick one, justify in ≤5 sentences against the
   findings. (Advisor's prior, to be confirmed or overturned by your
   evidence: (b) now, (a) when the RAG next needs real work.)
4. **Follow-up plan outline** — the steps a future executor plan would
   contain for the recommended option.

**Verify**: memo exists, all four sections present, every claim cites a
command output or file:line.

## Test plan

Not applicable (no code changes). The memo's claims must each carry their
evidence.

## Done criteria

- [ ] `docs/rag-decoupling-decision.md` exists with the four sections
- [ ] Every rag-only dep is explicitly listed with its importer evidence
- [ ] `git status` shows ONLY the memo and `plans/README.md` changed
- [ ] `pnpm typecheck` still exits 0 (nothing was touched)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any app-runtime module DOES import `lib/rag` — the isolation premise is
  wrong; report which, because option (b)'s devDependencies move would then
  break the build.
- You feel compelled to "just do option (b) while you're here" — no. Memo
  only.

## Maintenance notes

- The memo's option (a) interacts with plan 002 (CI) — a workspace split
  changes install/cache steps — and with the deploy pipeline
  (`migrate-on-deploy.mjs`). Whoever executes the chosen option must check
  both.
