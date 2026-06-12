# RAG (Docs Search)

A small local **retrieval system** that lets an AI coding assistant search library
docs (GrapesJS and friends) instead of guessing. It's developer tooling — it is *not*
part of the page builder's runtime or the published site.

## What it does

It ingests documentation and source into Postgres as embedded text **chunks**, then
exposes a search tool over them via **MCP** (Model Context Protocol). When you ask
Claude/Cursor a GrapesJS question, the assistant calls the `search_grapesjs_docs`
tool, which does a vector similarity search and returns the most relevant chunks with
their source URLs.

```
docs / source  ──ingest──▶  Postgres (pgvector)  ──MCP tool──▶  AI assistant
   (crawl/fetch)            embedded chunks         search_grapesjs_docs
```

## How you use it

**As an assistant tool (the normal case).** The MCP server is registered in
`.mcp.json` as `grapesjs-docs`, so any MCP-aware client in this repo gets a
`search_grapesjs_docs` tool automatically. Just ask GrapesJS questions — the
assistant queries the local corpus. (This is the `mcp__grapesjs-docs__search_grapesjs_docs`
tool you'll see available.)

**To (re)populate the corpus.** Run an ingest script. Each pulls from one source:

```bash
pnpm ingest:grapesjs          # crawls grapesjs.com/docs (the main docs site)
pnpm ingest:grapesjs-react    # GrapesJS/react repo markdown
pnpm ingest:grapesjs-source   # GrapesJS/grapesjs source (.ts/.tsx as code chunks)
pnpm ingest:grapesjs-symbols  # silexlabs/grapesjs-symbols README + src
pnpm ingest:wp-themes         # WordPress theme.json handbook subtree
```

Ingests are **incremental and idempotent** — a chunk is keyed by a hash of its
content, so re-running only embeds and inserts what's new. Add `--dry-run` to preview
chunks without writing to the DB or calling the embedding API.

**To run the MCP server by hand** (clients normally do this for you):

```bash
pnpm mcp:rag
```

## One-time setup

1. **`GOOGLE_API_KEY`** in `.env` — embeddings use Google's `gemini-embedding-001`.
   (`GITHUB_TOKEN` is optional but raises GitHub API rate limits for the repo-based
   ingests.)
2. **pgvector** — the `vector` Postgres extension (declared in `prisma/schema.prisma`,
   applied by migrations). The same `DATABASE_URL` the app uses.
3. Run an ingest script to fill the corpus.

## Mental model

- One corpus, many sources — everything lands in the same `doc_chunks` table and is
  searchable through the one tool.
- The tool is for the assistant, not the app. No page-builder code imports `lib/rag`.
- Re-ingest whenever a library's docs move; old chunks for unchanged content are
  reused, not duplicated.

For the pipeline stages, the file map, the DB tables, and the gotchas, see
[rag.technical.md](rag.technical.md).
