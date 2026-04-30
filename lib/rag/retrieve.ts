import { embedQuery } from "./embed"
import { searchChunks, type StoredChunk } from "./store"

export type RetrievedChunk = StoredChunk

export async function retrieveDocs(
  query: string,
  k = 5
): Promise<RetrievedChunk[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const embedding = await embedQuery(trimmed)
  return searchChunks(embedding, k)
}

export function formatChunkCitation(chunk: RetrievedChunk): string {
  const url = chunk.urls[0]?.url ?? "(unknown source)"
  return `[${chunk.headerPath}] ${url}`
}
