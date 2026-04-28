import { randomUUID } from "node:crypto"

import { prisma } from "@/lib/prisma"

import type { Chunk } from "./split"

export type StoredChunk = {
  id: string
  contentHash: string
  content: string
  headerPath: string
  kind: string
  tokenCount: number
  similarity: number
  urls: { url: string; title: string }[]
}

export type UpsertResult = {
  newChunks: number
  reusedChunks: number
  urlsTouched: number
}

function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`
}

export async function existingHashes(
  hashes: string[],
): Promise<Set<string>> {
  if (hashes.length === 0) return new Set()
  const rows = await prisma.$queryRaw<{ contentHash: string }[]>`
    SELECT "contentHash" FROM doc_chunks
    WHERE "contentHash" = ANY(${hashes}::text[])
  `
  return new Set(rows.map((r) => r.contentHash))
}

export async function insertChunks(
  chunks: Chunk[],
  embeddings: number[][],
): Promise<number> {
  if (chunks.length !== embeddings.length) {
    throw new Error(
      `chunks/embeddings length mismatch: ${chunks.length} vs ${embeddings.length}`,
    )
  }
  let inserted = 0
  let skipped = 0
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]
    if (embeddings[i].length === 0) {
      skipped++
      console.warn(
        `[store] skipping chunk with empty embedding: ${c.headerPath} (${c.sourceUrl})`,
      )
      continue
    }
    const vec = toVectorLiteral(embeddings[i])
    const result = await prisma.$executeRaw`
      INSERT INTO doc_chunks (
        id, "contentHash", content, "headerPath", kind, "tokenCount", embedding
      ) VALUES (
        ${randomUUID()},
        ${c.contentHash},
        ${c.content},
        ${c.headerPath},
        ${c.kind},
        ${c.tokenCount},
        ${vec}::vector
      )
      ON CONFLICT ("contentHash") DO NOTHING
    `
    inserted += Number(result)
  }
  if (skipped > 0) {
    console.warn(`[store] skipped ${skipped} empty-embedding chunks`)
  }
  return inserted
}

export async function upsertChunkUrls(chunks: Chunk[]): Promise<number> {
  if (chunks.length === 0) return 0

  // Filter to chunks that actually exist in doc_chunks. A chunk may be
  // missing if its embedding came back empty and was skipped by
  // insertChunks; without this guard we'd hit a FK violation.
  const allHashes = [...new Set(chunks.map((c) => c.contentHash))]
  const existingRows = await prisma.$queryRaw<{ contentHash: string }[]>`
    SELECT "contentHash" FROM doc_chunks
    WHERE "contentHash" = ANY(${allHashes}::text[])
  `
  const valid = new Set(existingRows.map((r) => r.contentHash))

  // Dedupe (contentHash, url) pairs and skip any chunk not in `valid`.
  const seen = new Set<string>()
  const rows = chunks.flatMap((c) => {
    if (!valid.has(c.contentHash)) return []
    const key = `${c.contentHash}|${c.sourceUrl}`
    if (seen.has(key)) return []
    seen.add(key)
    return [
      {
        id: randomUUID(),
        chunkHash: c.contentHash,
        url: c.sourceUrl,
        title: c.sourceTitle,
      },
    ]
  })

  let touched = 0
  for (const row of rows) {
    const result = await prisma.$executeRaw`
      INSERT INTO doc_chunk_urls (id, "chunkHash", url, title, "lastSeenAt")
      VALUES (${row.id}, ${row.chunkHash}, ${row.url}, ${row.title}, NOW())
      ON CONFLICT ("chunkHash", url)
      DO UPDATE SET title = EXCLUDED.title, "lastSeenAt" = NOW()
    `
    touched += Number(result)
  }
  return touched
}

export async function searchChunks(
  queryEmbedding: number[],
  k: number,
): Promise<StoredChunk[]> {
  const vec = toVectorLiteral(queryEmbedding)
  const rows = await prisma.$queryRaw<
    {
      id: string
      contentHash: string
      content: string
      headerPath: string
      kind: string
      tokenCount: number
      similarity: number
    }[]
  >`
    SELECT id, "contentHash", content, "headerPath", kind, "tokenCount",
           1 - (embedding <=> ${vec}::vector) AS similarity
    FROM doc_chunks
    ORDER BY embedding <=> ${vec}::vector
    LIMIT ${k}
  `

  if (rows.length === 0) return []

  const hashes = rows.map((r) => r.contentHash)
  const urlRows = await prisma.$queryRaw<
    { chunkHash: string; url: string; title: string }[]
  >`
    SELECT "chunkHash", url, title FROM doc_chunk_urls
    WHERE "chunkHash" = ANY(${hashes}::text[])
  `

  const urlsByHash = new Map<string, { url: string; title: string }[]>()
  for (const r of urlRows) {
    const list = urlsByHash.get(r.chunkHash) ?? []
    list.push({ url: r.url, title: r.title })
    urlsByHash.set(r.chunkHash, list)
  }

  return rows.map((r) => ({
    ...r,
    similarity: Number(r.similarity),
    urls: urlsByHash.get(r.contentHash) ?? [],
  }))
}
