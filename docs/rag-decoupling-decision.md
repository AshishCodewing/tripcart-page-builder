# RAG side-project decoupling — decision memo (plan 006)

Investigated 2026-06-12 on `main` (`9dfd975`). All commands read-only; no
source files changed. Evidence cited inline as `command → result` or
`file:line`.

## 1. Findings

### Isolation boundary (clean, with one shared seam)

- **No app-runtime module imports `lib/rag`.**
  `grep -rn "lib/rag|@/lib/rag" app components lib hooks` (excluding
  `lib/rag` itself) → empty.
- **`lib/rag` imports nothing from the CMS/app code.**
  `grep -rn 'from "@/lib/cms|from "@/app|from "@/components"' lib/rag` →
  empty.
- **One shared seam: the Prisma client.** `lib/rag/store.ts:3` imports
  `prisma` from `@/lib/prisma` — the same client/generated schema the app
  uses. Extraction (option a) must give the RAG package its own client.
- **Consumers are exactly six scripts**:
  `grep -rln "lib/rag" scripts` → the five `ingest-*.ts` scripts +
  `scripts/mcp-rag-server.ts`. The active consumer is `.mcp.json`
  (`grapesjs-docs` server → `pnpm mcp:rag`), used in the maintainer's
  editor sessions — including during this investigation.

### RAG-only dependencies (10, all in `dependencies`)

Importer evidence (`grep -rln <dep> app components lib hooks scripts`):

| Dependency | Only importers | Size (`du -shL`) |
|---|---|---|
| `@langchain/core` | none directly (peer of the two below) | 13M (whole `@langchain`) |
| `@langchain/google-genai` | `lib/rag/embed.ts` | — |
| `@langchain/textsplitters` | `lib/rag/split.ts` | — |
| `@google/generative-ai` | `lib/rag/embed.ts` | 612K |
| `@modelcontextprotocol/sdk` | `scripts/mcp-rag-server.ts` | 5.8M |
| `cheerio` | `lib/rag/scrape.ts`, `lib/rag/clean.ts` | 1.5M |
| `turndown` | `lib/rag/clean.ts` | 208K |
| `@joplin/turndown-plugin-gfm` | `lib/rag/clean.ts` | 24K |
| `gpt-tokenizer` | `lib/rag/split.ts` | **55M** |
| `p-queue` | `lib/rag/scrape.ts` | 120K |

Total install weight ≈ **76 MB**, dominated by `gpt-tokenizer`.

### Audit attribution (`pnpm audit --prod`: 31 findings — 3 low / 17 moderate / 11 high)

- **RAG-attributable**: `hono` ×9 (8 moderate + 1 low) and
  `@hono/node-server` ×1 via `@modelcontextprotocol/sdk`; `langsmith` ×1
  **high** via `@langchain/*` (purely RAG — the only high-severity finding
  RAG owns outright).
- **NOT RAG-only, despite appearances** (`pnpm why --prod`): `hono` and
  `@hono/node-server` are also reachable via `@prisma/client → prisma
  (peer) → @prisma/dev` and via `shadcn → @modelcontextprotocol/sdk`;
  `fast-uri` ×2 high traces to MCP SDK *and* `@prisma/client` *and*
  `shadcn`; `qs` / `ip-address` trace to MCP SDK and `shadcn`. So removing
  RAG deps reduces, but does **not** zero, the hono/fast-uri noise.
- **Unrelated to RAG**: `next` ×14 (8 high — the ≥16.2.5 bump, tracked in
  plans/README.md), `postcss` (via next), `brace-expansion` (via shadcn).
- **Side finding for plan 007**: the `shadcn` **CLI** (v4.5.0) sits in
  production `dependencies` (package.json:62) and itself pulls the MCP
  SDK — it belongs in `devDependencies` and muddies any RAG-only audit
  attribution until moved.

### Schema, migrations, deploy coupling

- `prisma/schema.prisma:14` — `extensions = [vector]` on the datasource;
  `DocChunk` / `DocChunkUrl` models at lines 192–219 with
  `embedding Unsupported("vector(3072)")`.
- Exactly **one** RAG migration: `20260428000000_init_grapesjs_rag` —
  `CREATE EXTENSION IF NOT EXISTS "vector"` + `doc_chunks` +
  `doc_chunk_urls` (+ a comment documenting the 2000-dim index cap and the
  halfvec upgrade path).
- `package.json` `prebuild` runs `scripts/migrate-on-deploy.mjs` on every
  production build, so this migration **has been applied to prod**: the
  production Postgres already runs pgvector and holds the ingested corpus.
  The hosting constraint is sunk cost, not a pending risk — it re-becomes
  a constraint only if the DB is ever migrated to a non-pgvector host.
- Package scripts: `ingest:*` ×5 + `mcp:rag` (package.json:18–23);
  `.env.example` documents `GOOGLE_API_KEY` (embeddings, line 6) and
  `ANTHROPIC_API_KEY` (line 10) as RAG-related.

## 2. Options

### (a) Extract to a sibling repo / workspace package — effort M–L

Move `lib/rag/`, the five ingest scripts, `mcp-rag-server.ts`, and the 10
deps into a new package with its own `prisma/schema.prisma` (Doc* models +
vector extension), its own migration baseline, its own Prisma client
(resolving the `@/lib/prisma` seam), and `.mcp.json` repointed. Main-app
schema drops the Doc* models and `extensions = [vector]`.
**Unresolved question that needs the maintainer**: the fate of the existing
prod `doc_chunks` tables — dropping the models without a migration leaves
orphan tables; writing the drop migration destroys the ingested corpus
(re-ingestable, but costs API quota and time); pointing the new package at
the same DATABASE_URL keeps the corpus but keeps the pgvector requirement
on the prod DB anyway, which forfeits half the benefit.
**Interacts with**: CI (plan 002's workflow assumes a single package) and
`migrate-on-deploy.mjs` (must not see RAG migrations after the split).

### (b) Keep in-repo, isolate the blast radius — effort S

Move the 10 RAG-only deps to `devDependencies`. Verified safe by the
Step-1 greps: nothing the app bundles imports them (Next only bundles
imported modules), and the scripts already run under `tsx`, itself a
devDependency. CI (`pnpm install --frozen-lockfile`) and Vercel builds
install devDependencies anyway — nothing breaks.
**Fixes**: the `langsmith` high finding and the MCP-SDK share of the hono
noise leave `pnpm audit --prod`; prod-only installs (`pnpm install --prod`)
shed ~76 MB.
**Does not fix**: the pgvector requirement, the Doc* models in the shared
schema, the migration coupling — and the hono findings persist partially
via the `@prisma/dev` and `shadcn` paths (the latter until plan 007 moves
the shadcn CLI to devDependencies, which should ride along).

### (c) Delete — rejected by the evidence

The maintainer actively uses the MCP server: `.mcp.json` wires it into
every editor session, the WP Themes Handbook was ingested 2026-06, and the
`search_grapesjs_docs` tool was used during this very investigation.
Deletion also requires the same prod-table decision as (a), with none of
the upside.

## 3. Recommendation

**(b) now; revisit (a) only when the RAG next needs real work** — the
advisor's prior, confirmed by the evidence. The isolation boundary is
already clean (no app imports, one Prisma-client seam), so the recurring
cost is concentrated in audit attribution and dependency weight — exactly
what (b) fixes for a one-file change. The pgvector/schema coupling that
only (a) removes is sunk cost: prod already runs the extension and holds
the corpus, and no current plan changes DB hosting. (a)'s hard question —
what happens to the prod corpus tables — deserves a deliberate decision,
not a side effect of a cleanup. Fold (b) into plan 007's hygiene batch
(it's a `package.json` dependency-placement change of the same species as
moving the `shadcn` CLI, and doing both together maximizes the audit-noise
reduction).

## 4. Follow-up plan outline (for the chosen option b)

1. **Drift check**: re-run the Step-1 greps; STOP if any app-runtime
   import of `lib/rag` or a RAG-only dep has appeared since this memo.
2. Move the 10 deps listed above from `dependencies` to `devDependencies`
   in `package.json` (alphabetical order preserved); move the `shadcn` CLI
   alongside (or confirm plan 007 already did).
3. `pnpm install` → lockfile updates only its importer graph metadata;
   commit both files together.
4. Verify: `pnpm typecheck && pnpm lint && pnpm test` all green;
   `pnpm build` locally (or rely on the Vercel preview build) to prove the
   app bundle never needed those deps; `pnpm mcp:rag` starts and answers
   one query (dev-time smoke, needs `.env`); one `ingest:*` script
   `--help`/dry start if available — do NOT run a real ingest.
5. Record the audit delta: `pnpm audit --prod` before/after in the PR body
   (expect `langsmith` high gone; hono reduced but persisting via
   `@prisma/dev` and, if not yet moved, `shadcn`).
6. Leave schema, migrations, `.mcp.json`, and all `lib/rag`/script code
   untouched. Note in the PR that option (a) remains documented here for
   when the RAG needs its next real investment.
