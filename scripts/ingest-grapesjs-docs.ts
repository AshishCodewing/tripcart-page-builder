import "dotenv/config"

import { htmlToMarkdown, type CleanedPage } from "@/lib/rag/clean"
import { embedBatch } from "@/lib/rag/embed"
import { crawlDocs } from "@/lib/rag/scrape"
import { splitMarkdown, type Chunk } from "@/lib/rag/split"
import {
  existingHashes,
  insertChunks,
  upsertChunkUrls,
} from "@/lib/rag/store"

const ROOT_URL = "https://grapesjs.com/docs/"
const PATH_PREFIX = "/docs/"

type Args = {
  dryRun: boolean
  maxPages: number
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, maxPages: 500 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--dry-run") args.dryRun = true
    else if (a === "--max-pages") args.maxPages = Number(argv[++i] ?? 500)
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  console.log(
    `\n[ingest] starting (${args.dryRun ? "DRY RUN" : "live"}, max ${args.maxPages} pages)\n`,
  )

  console.log(`[ingest] crawling ${ROOT_URL}…`)
  const rawPages = await crawlDocs({
    rootUrl: ROOT_URL,
    pathPrefix: PATH_PREFIX,
    maxPages: args.maxPages,
    onPage: (url, total) => {
      if (total % 10 === 0) console.log(`  fetched ${total}: ${url}`)
    },
  })
  console.log(`[ingest] crawled ${rawPages.length} pages\n`)

  if (rawPages.length === 0) {
    console.warn("[ingest] no pages — aborting")
    return
  }

  console.log("[ingest] cleaning + splitting…")
  const cleanedPages: CleanedPage[] = []
  const chunks: Chunk[] = []
  for (const raw of rawPages) {
    const cleaned = htmlToMarkdown(raw)
    if (!cleaned.markdown.trim()) continue
    cleanedPages.push(cleaned)
    const pageChunks = await splitMarkdown(cleaned)
    chunks.push(...pageChunks)
  }
  console.log(
    `[ingest] produced ${chunks.length} chunks from ${cleanedPages.length} pages`,
  )
  const apiCount = chunks.filter((c) => c.kind === "api").length
  const narrativeCount = chunks.length - apiCount
  console.log(`         api: ${apiCount}  narrative: ${narrativeCount}\n`)

  if (chunks.length === 0) {
    console.warn("[ingest] no chunks produced — aborting")
    return
  }

  if (args.dryRun) {
    console.log("[ingest] DRY RUN — sample chunks:\n")
    const sample = chunks.slice(0, 5)
    for (const c of sample) {
      const preview = c.content.slice(0, 200).replace(/\n/g, " ")
      console.log(
        `  [${c.kind}] ${c.headerPath}  (${c.tokenCount} tok)\n    ${c.sourceUrl}\n    ${preview}…\n`,
      )
    }
    console.log("[ingest] dry run complete — no DB writes, no OpenAI calls.")
    return
  }

  console.log("[ingest] checking which chunks need embedding…")
  const allHashes = chunks.map((c) => c.contentHash)
  const existing = await existingHashes(allHashes)

  // Dedupe by hash within this batch — same hash may repeat across URLs.
  const uniqueByHash = new Map<string, Chunk>()
  for (const c of chunks) {
    if (existing.has(c.contentHash)) continue
    if (!uniqueByHash.has(c.contentHash)) uniqueByHash.set(c.contentHash, c)
  }
  const newChunks = [...uniqueByHash.values()]
  console.log(
    `         ${newChunks.length} new, ${existing.size} reused, ${chunks.length - newChunks.length - existing.size} dupes-in-batch\n`,
  )

  if (newChunks.length > 0) {
    console.log("[ingest] embedding…")
    const embeddings = await embedBatch(newChunks.map((c) => c.content))
    console.log("[ingest] inserting chunks…")
    const inserted = await insertChunks(newChunks, embeddings)
    console.log(`         inserted ${inserted}\n`)
  }

  console.log("[ingest] upserting chunk→url rows…")
  const touched = await upsertChunkUrls(chunks)
  console.log(`         touched ${touched}\n`)

  console.log("[ingest] done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
