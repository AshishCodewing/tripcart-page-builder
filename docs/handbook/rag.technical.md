# RAG — technical

Read [rag.md](rag.md) first. Code lives in `lib/rag/` (the pipeline) and `scripts/`
(the ingest entrypoints + MCP server).

## Pipeline

```
crawl/fetch ──▶ clean ──▶ split ──▶ embed ──▶ store        (ingest, write path)
 scrape.ts     clean.ts   split.ts  embed.ts  store.ts

embed query ──▶ vector search ──▶ format                   (retrieve, read path)
 embed.ts        store.ts          retrieve.ts ──▶ MCP tool (mcp-rag-server.ts)
```

## Files (`lib/rag/`)

| File | Responsibility |
|---|---|
| `scrape.ts` | `crawlDocs(opts)` — polite BFS crawler (p-queue, concurrency, delay+jitter, path-prefix include/exclude, maxPages). Returns `RawPage[]` of HTML. |
| `github.ts` | Repo-based sources: `listMarkdownFiles` (git tree API), `fetchMarkdownPage` (raw `.md`), `fetchSourcePage` (wraps `.ts/.tsx` in a fenced code block as markdown). Uses `GITHUB_TOKEN` if present. |
| `clean.ts` | `htmlToMarkdown(rawPage)` — cheerio strips nav/aside/footer/etc., picks the main content node, Turndown (+GFM) → markdown. Classifies `kind` as `api` vs `narrative` by URL path. |
| `split.ts` | `splitMarkdown(page)` → `Chunk[]`. Splits on `#`/`##`/`###` headings (fence-aware so `#` inside code never false-splits), size-caps narrative sections (~600 tokens, 80 overlap) while protecting code fences. `contentHash = sha256(kind + content)`. Drops empty/heading-only chunks. |
| `embed.ts` | `embedBatch(texts)` (documents) + `embedQuery(q)` (query). Google `gemini-embedding-001`, **3072 dims**. Batches of 20 with 1.5s spacing; retries empty vectors (free tier returns empty, not an error, when rate-limited). |
| `store.ts` | Postgres via raw SQL (pgvector). `existingHashes`, `insertChunks` (ON CONFLICT DO NOTHING), `upsertChunkUrls`, `searchChunks(embedding, k)` (cosine `<=>`, returns similarity + source urls). |
| `retrieve.ts` | `retrieveDocs(query, k=5)` = embed query → `searchChunks`. `formatChunkCitation(chunk)`. |

## Database (`prisma/schema.prisma`)

- **`DocChunk`** (`doc_chunks`) — `contentHash` (unique, the dedup key), `content`,
  `headerPath` (e.g. `Page > Section > Sub`), `kind`, `tokenCount`,
  `embedding vector(3072)` (the `Unsupported("vector(3072)")` column; needs the
  `vector` extension). Written via raw SQL because Prisma can't type the vector column.
- **`DocChunkUrl`** (`doc_chunk_urls`) — many source URLs per chunk
  (`@@unique([chunkHash, url])`). Identical content from two pages is stored once and
  cited from both.

## Ingest scripts (`scripts/`)

All share the pipeline; they differ only in source config. Common flags:
`--dry-run` (no DB / no embedding calls, prints sample chunks), `--max-pages N`
(crawl-based ones).

| Script (`pnpm …`) | Source |
|---|---|
| `ingest:grapesjs` | crawl `https://grapesjs.com/docs/` (`/docs/` prefix) |
| `ingest:grapesjs-react` | GitHub `GrapesJS/react@main` markdown |
| `ingest:grapesjs-source` | GitHub `GrapesJS/grapesjs@dev` source files (code chunks) |
| `ingest:grapesjs-symbols` | GitHub `silexlabs/grapesjs-symbols@main` README + src |
| `ingest:wp-themes` | crawl WP handbook: theme-structure + global-settings-and-styles |

Ingest flow (see `ingest-grapesjs-docs.ts`): crawl/fetch → clean → split → compute
hashes → `existingHashes` to skip known + dedupe within batch → `embedBatch` the new
ones → `insertChunks` → `upsertChunkUrls` (always, to refresh citations/`lastSeenAt`).

## MCP server (`scripts/mcp-rag-server.ts`)

Stdio MCP server named `grapesjs-docs`, exposing one tool **`search_grapesjs_docs`**
(`{ query: string, k?: number≤20 }`). It calls `retrieveDocs` and returns the top-k
chunks formatted with `headerPath`, source URL, and similarity. Registered in
`.mcp.json` (`command: pnpm run --silent mcp:rag`); the resulting tool surfaces to
clients as `mcp__grapesjs-docs__search_grapesjs_docs`. **stdout is reserved for MCP
frames** — the server logs only to stderr.

## Gotchas

- **Empty embeddings**: Google's free tier returns a zero-length vector (no error)
  under rate limiting. `embed.ts` retries; `store.ts` skips any still-empty chunk and
  guards the URL FK against it. Pacing/batch size in `embed.ts` exist for this.
- **Dims are fixed at 3072** — the schema column, `EMBEDDING_DIMS`, and the model must
  agree. Changing the embedding model means a migration + full re-ingest.
- **Dedup is content-hash based** (`sha256(kind + trimmed content)`), so identical
  text across pages embeds once and is cited from many URLs.
- **Heading-only / whitespace chunks are dropped** before embedding (pgvector rejects
  zero-dim vectors).
- This is dev tooling: nothing under `lib/rag` is imported by the app or shipped to
  the published site.
