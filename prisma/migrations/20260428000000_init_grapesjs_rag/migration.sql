-- pgvector extension
CREATE EXTENSION IF NOT EXISTS "vector";

-- DocChunk: keyed by content hash so identical chunks across pages share one embedding.
CREATE TABLE "doc_chunks" (
  "id"          TEXT PRIMARY KEY,
  "contentHash" TEXT NOT NULL UNIQUE,
  "content"     TEXT NOT NULL,
  "headerPath"  TEXT NOT NULL,
  "kind"        TEXT NOT NULL,
  "tokenCount"  INTEGER NOT NULL,
  "embedding"   vector(3072) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- DocChunkUrl: a chunk may originate from multiple URLs (e.g. shared boilerplate sections).
CREATE TABLE "doc_chunk_urls" (
  "id"         TEXT PRIMARY KEY,
  "chunkHash"  TEXT NOT NULL,
  "url"        TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "doc_chunk_urls_chunkHash_fkey"
    FOREIGN KEY ("chunkHash") REFERENCES "doc_chunks"("contentHash")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "doc_chunk_urls_chunkHash_url_key"
  ON "doc_chunk_urls" ("chunkHash", "url");

CREATE INDEX "doc_chunk_urls_url_idx"
  ON "doc_chunk_urls" ("url");

-- Vector index intentionally omitted at this scale (~2k chunks). Sequential scan
-- on cosine distance is well under 1s. Add an index when the corpus exceeds ~50k.
-- Note: pgvector's hnsw/ivfflat indexes cap at 2000 dims for `vector`, so at
-- 3072 dims we'd need to switch to halfvec (pgvector >= 0.7):
-- ALTER TABLE "doc_chunks" ALTER COLUMN "embedding" TYPE halfvec(3072);
-- CREATE INDEX ON "doc_chunks" USING hnsw ("embedding" halfvec_cosine_ops);
