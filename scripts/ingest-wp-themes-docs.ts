import "dotenv/config"

import { htmlToMarkdown, type CleanedPage } from "@/lib/rag/clean"
import { embedBatch } from "@/lib/rag/embed"
import { crawlDocs } from "@/lib/rag/scrape"
import { splitMarkdown, type Chunk } from "@/lib/rag/split"
import { existingHashes, insertChunks, upsertChunkUrls } from "@/lib/rag/store"

// Narrow, reference-only scope. The full Theme Handbook covers a lot we
// don't need; these two subtrees carry the architecture signal we use
// (files/folder layout + the entire theme.json / Global Styles surface,
// which itself nests templates, template-parts, patterns, style-variations).
type Target = { rootUrl: string; pathPrefix: string }
const TARGETS: Target[] = [
  {
    rootUrl:
      "https://developer.wordpress.org/themes/core-concepts/theme-structure/",
    pathPrefix: "/themes/core-concepts/theme-structure",
  },
  {
    rootUrl:
      "https://developer.wordpress.org/themes/global-settings-and-styles/",
    pathPrefix: "/themes/global-settings-and-styles",
  },
]

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
    `\n[ingest:wp-themes] starting (${args.dryRun ? "DRY RUN" : "live"}, max ${args.maxPages} pages)\n`
  )

  const rawPages = []
  for (const target of TARGETS) {
    console.log(`[ingest:wp-themes] crawling ${target.rootUrl}…`)
    const pages = await crawlDocs({
      rootUrl: target.rootUrl,
      pathPrefix: target.pathPrefix,
      maxPages: args.maxPages,
      onPage: (url, total) => {
        if (total % 10 === 0) console.log(`  fetched ${total}: ${url}`)
      },
    })
    console.log(`  -> ${pages.length} pages`)
    rawPages.push(...pages)
  }
  console.log(`[ingest:wp-themes] crawled ${rawPages.length} pages total\n`)

  if (rawPages.length === 0) {
    console.warn("[ingest:wp-themes] no pages — aborting")
    return
  }

  console.log("[ingest:wp-themes] cleaning + splitting…")
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
    `[ingest:wp-themes] produced ${chunks.length} chunks from ${cleanedPages.length} pages\n`
  )

  if (chunks.length === 0) {
    console.warn("[ingest:wp-themes] no chunks produced — aborting")
    return
  }

  if (args.dryRun) {
    console.log("[ingest:wp-themes] DRY RUN — discovered URLs:\n")
    for (const p of cleanedPages) {
      console.log(`  ${p.url}`)
    }
    console.log("\n[ingest:wp-themes] sample chunks:\n")
    const sample = chunks.slice(0, 5)
    for (const c of sample) {
      const preview = c.content.slice(0, 200).replace(/\n/g, " ")
      console.log(
        `  [${c.kind}] ${c.headerPath}  (${c.tokenCount} tok)\n    ${c.sourceUrl}\n    ${preview}…\n`
      )
    }
    console.log(
      "[ingest:wp-themes] dry run complete — no DB writes, no embedding calls."
    )
    return
  }

  console.log("[ingest:wp-themes] checking which chunks need embedding…")
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
    console.log("[ingest:wp-themes] embedding…")
    const embeddings = await embedBatch(newChunks.map((c) => c.content))
    console.log("[ingest:wp-themes] inserting chunks…")
    const inserted = await insertChunks(newChunks, embeddings)
    console.log(`         inserted ${inserted}\n`)
  }

  console.log("[ingest:wp-themes] upserting chunk→url rows…")
  const touched = await upsertChunkUrls(chunks)
  console.log(`         touched ${touched}\n`)

  console.log("[ingest:wp-themes] done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
