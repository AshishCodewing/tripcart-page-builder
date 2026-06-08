import "dotenv/config"

import type { CleanedPage } from "@/lib/rag/clean"
import { embedBatch } from "@/lib/rag/embed"
import {
  fetchMarkdownPage,
  fetchSourcePage,
  type GithubMarkdownSource,
} from "@/lib/rag/github"
import { splitMarkdown, type Chunk } from "@/lib/rag/split"
import { existingHashes, insertChunks, upsertChunkUrls } from "@/lib/rag/store"

const SOURCE: GithubMarkdownSource = {
  owner: "silexlabs",
  repo: "grapesjs-symbols",
  ref: "main",
}

// README first so its narrative anchors the source files in retrieval.
const MARKDOWN_PATHS = ["README.md"]

// All non-test TypeScript files in src/. Test files and test-utils are
// excluded — they're useful for the maintainers but pure noise for an
// API-reference RAG.
const SOURCE_PATHS = [
  "src/index.ts",
  "src/SymbolsCommands.ts",
  "src/capabilities.ts",
  "src/events.ts",
  "src/id-utils.ts",
  "src/utils.ts",
  "src/view/SymbolsView.ts",
  "src/view/traits.ts",
]

const SOURCE_TITLE_STRIP_PREFIX = "src/"

type Args = {
  dryRun: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false }
  for (const a of argv) {
    if (a === "--dry-run") args.dryRun = true
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  console.log(
    `\n[ingest:symbols] starting (${args.dryRun ? "DRY RUN" : "live"}) — ${SOURCE.owner}/${SOURCE.repo}@${SOURCE.ref}\n`
  )

  console.log("[ingest:symbols] fetching pages…")
  const cleanedPages: CleanedPage[] = []

  for (const path of MARKDOWN_PATHS) {
    const page = await fetchMarkdownPage(SOURCE, path)
    if (page) {
      cleanedPages.push(page)
      console.log(`  fetched (md): ${path}`)
    }
  }

  for (const path of SOURCE_PATHS) {
    const page = await fetchSourcePage(SOURCE, path, {
      titleStripPrefix: SOURCE_TITLE_STRIP_PREFIX,
    })
    if (page) {
      cleanedPages.push(page)
      console.log(`  fetched (src): ${path}`)
    }
  }

  console.log(`[ingest:symbols] cleaned ${cleanedPages.length} pages\n`)

  if (cleanedPages.length === 0) {
    console.warn("[ingest:symbols] no pages — aborting")
    return
  }

  console.log("[ingest:symbols] splitting…")
  const chunks: Chunk[] = []
  for (const page of cleanedPages) {
    const pageChunks = await splitMarkdown(page)
    chunks.push(...pageChunks)
  }
  console.log(`[ingest:symbols] produced ${chunks.length} chunks\n`)

  if (chunks.length === 0) {
    console.warn("[ingest:symbols] no chunks produced — aborting")
    return
  }

  if (args.dryRun) {
    console.log("[ingest:symbols] DRY RUN — sample chunks:\n")
    for (const c of chunks.slice(0, 5)) {
      const preview = c.content.slice(0, 200).replace(/\n/g, " ")
      console.log(
        `  [${c.kind}] ${c.headerPath}  (${c.tokenCount} tok)\n    ${c.sourceUrl}\n    ${preview}…\n`
      )
    }
    console.log(
      "[ingest:symbols] dry run complete — no DB writes, no embedding calls."
    )
    return
  }

  console.log("[ingest:symbols] checking which chunks need embedding…")
  const allHashes = chunks.map((c) => c.contentHash)
  const existing = await existingHashes(allHashes)

  const uniqueByHash = new Map<string, Chunk>()
  for (const c of chunks) {
    if (existing.has(c.contentHash)) continue
    if (!uniqueByHash.has(c.contentHash)) uniqueByHash.set(c.contentHash, c)
  }
  const newChunks = [...uniqueByHash.values()]
  console.log(
    `         ${newChunks.length} new, ${existing.size} reused, ${chunks.length - newChunks.length - existing.size} dupes-in-batch\n`
  )

  if (newChunks.length > 0) {
    console.log("[ingest:symbols] embedding…")
    const embeddings = await embedBatch(newChunks.map((c) => c.content))
    console.log("[ingest:symbols] inserting chunks…")
    const inserted = await insertChunks(newChunks, embeddings)
    console.log(`         inserted ${inserted}\n`)
  }

  console.log("[ingest:symbols] upserting chunk→url rows…")
  const touched = await upsertChunkUrls(chunks)
  console.log(`         touched ${touched}\n`)

  console.log("[ingest:symbols] done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
