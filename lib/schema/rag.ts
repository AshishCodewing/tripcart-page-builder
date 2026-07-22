import { relations } from "drizzle-orm"
import {
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core"

import { createdAt, cuid, timestampNow } from "./_shared"

// DocChunk.embedding is `vector(3072)` (pgvector). It is NEVER read/written
// through the typed API — only via raw `sql` in lib/rag/store.ts (insert +
// `<=>` cosine search). It's declared here so the column is part of the schema
// (and the baseline diff), not to query it typed. No ANN index: 3072 dims
// exceed pgvector's 2000-dim cap, so search is a sequential scan (unchanged).
export const docChunks = pgTable(
  "doc_chunks",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    contentHash: text("contentHash").notNull(),
    content: text("content").notNull(),
    headerPath: text("headerPath").notNull(),
    kind: text("kind").notNull(),
    // Corpus bucket (e.g. "grapesjs", "prosemirror"). Lets a per-corpus MCP
    // tool filter retrieval so ProseMirror results don't mix with GrapesJS.
    // Existing rows backfill to "grapesjs" via the NOT NULL DEFAULT.
    source: text("source").notNull().default("grapesjs"),
    tokenCount: integer("tokenCount").notNull(),
    embedding: vector("embedding", { dimensions: 3072 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("doc_chunks_contentHash_key").on(t.contentHash),
    index("doc_chunks_source_idx").on(t.source),
  ]
)

export const docChunkUrls = pgTable(
  "doc_chunk_urls",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    // FK targets a NON-primary column (doc_chunks.contentHash), matching Prisma.
    chunkHash: text("chunkHash")
      .notNull()
      .references(() => docChunks.contentHash, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    lastSeenAt: timestampNow("lastSeenAt"),
  },
  (t) => [
    uniqueIndex("doc_chunk_urls_chunkHash_url_key").on(t.chunkHash, t.url),
    index("doc_chunk_urls_url_idx").on(t.url),
  ]
)

export const docChunksRelations = relations(docChunks, ({ many }) => ({
  urls: many(docChunkUrls),
}))

export const docChunkUrlsRelations = relations(docChunkUrls, ({ one }) => ({
  chunk: one(docChunks, {
    fields: [docChunkUrls.chunkHash],
    references: [docChunks.contentHash],
  }),
}))

export type DocChunk = typeof docChunks.$inferSelect
export type DocChunkUrl = typeof docChunkUrls.$inferSelect
