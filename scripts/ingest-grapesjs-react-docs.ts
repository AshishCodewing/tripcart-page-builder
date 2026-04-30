import "dotenv/config"

import type { CleanedPage } from "@/lib/rag/clean"
import { embedBatch } from "@/lib/rag/embed"
import {
  fetchMarkdownPage,
  listMarkdownFiles,
  type GithubMarkdownSource,
} from "@/lib/rag/github"
import { splitMarkdown, type Chunk } from "@/lib/rag/split"
import { existingHashes, insertChunks, upsertChunkUrls } from "@/lib/rag/store"

const SOURCE: GithubMarkdownSource = {
  owner: "GrapesJS",
  repo: "react",
  ref: "main",
  excludePaths: ["CHANGELOG.md", "node_modules", ".github"],
}

type Args = {
  dryRun: boolean
  maxFiles: number
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, maxFiles: 200 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--dry-run") args.dryRun = true
    else if (a === "--max-files") args.maxFiles = Number(argv[++i] ?? 200)
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  console.log(
    `\n[ingest:react] starting (${args.dryRun ? "DRY RUN" : "live"}, max ${args.maxFiles} files)\n`
  )

  console.log(
    `[ingest:react] listing markdown in ${SOURCE.owner}/${SOURCE.repo}@${SOURCE.ref}…`
  )
  const allPaths = await listMarkdownFiles(SOURCE)
  const paths = allPaths.slice(0, args.maxFiles)
  console.log(
    `[ingest:react] found ${allPaths.length} files, processing ${paths.length}\n`
  )

  if (paths.length === 0) {
    console.warn("[ingest:react] no files — aborting")
    return
  }

  console.log("[ingest:react] fetching pages…")
  const cleanedPages: CleanedPage[] = []
  for (const path of paths) {
    const page = await fetchMarkdownPage(SOURCE, path)
    if (page) {
      cleanedPages.push(page)
      console.log(`  fetched: ${path}`)
    }
  }
  console.log(`[ingest:react] cleaned ${cleanedPages.length} pages\n`)

  console.log("[ingest:react] splitting…")
  const chunks: Chunk[] = []
  for (const page of cleanedPages) {
    const pageChunks = await splitMarkdown(page)
    chunks.push(...pageChunks)
  }
  console.log(`[ingest:react] produced ${chunks.length} chunks\n`)

  if (chunks.length === 0) {
    console.warn("[ingest:react] no chunks produced — aborting")
    return
  }

  if (args.dryRun) {
    console.log("[ingest:react] DRY RUN — sample chunks:\n")
    const sample = chunks.slice(0, 5)
    for (const c of sample) {
      const preview = c.content.slice(0, 200).replace(/\n/g, " ")
      console.log(
        `  [${c.kind}] ${c.headerPath}  (${c.tokenCount} tok)\n    ${c.sourceUrl}\n    ${preview}…\n`
      )
    }
    console.log(
      "[ingest:react] dry run complete — no DB writes, no embedding calls."
    )
    return
  }

  console.log("[ingest:react] checking which chunks need embedding…")
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
    console.log("[ingest:react] embedding…")
    const embeddings = await embedBatch(newChunks.map((c) => c.content))
    console.log("[ingest:react] inserting chunks…")
    const inserted = await insertChunks(newChunks, embeddings)
    console.log(`         inserted ${inserted}\n`)
  }

  console.log("[ingest:react] upserting chunk→url rows…")
  const touched = await upsertChunkUrls(chunks)
  console.log(`         touched ${touched}\n`)

  console.log("[ingest:react] done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
