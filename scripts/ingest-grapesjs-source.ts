import "dotenv/config"

import type { CleanedPage } from "@/lib/rag/clean"
import { embedBatch } from "@/lib/rag/embed"
import {
  fetchSourcePage,
  listMarkdownFiles,
  type GithubMarkdownSource,
} from "@/lib/rag/github"
import { splitMarkdown, type Chunk } from "@/lib/rag/split"
import { existingHashes, insertChunks, upsertChunkUrls } from "@/lib/rag/store"

const SOURCE: GithubMarkdownSource = {
  owner: "GrapesJS",
  repo: "grapesjs",
  ref: "dev",
}

const SRC_PREFIX = "packages/core/src/"

/**
 * Hardcoded list of TS files that hold authoritative event/type
 * definitions. Each module exports its event constants and type
 * declarations from its own `types.ts`.
 */
const SOURCE_PATHS = [
  "asset_manager/types.ts",
  "block_manager/types.ts",
  "canvas/types.ts",
  "commands/types.ts",
  "css_composer/types.ts",
  "data_sources/types.ts",
  "device_manager/types.ts",
  "dom_components/types.ts",
  "dom_components/model/types.ts",
  "editor/types.ts",
  "i18n/types.ts",
  "keymaps/types.ts",
  "modal_dialog/types.ts",
  "navigator/types.ts",
  "pages/types.ts",
  "parser/types.ts",
  "rich_text_editor/types.ts",
  "selector_manager/types.ts",
  "storage_manager/types.ts",
  "style_manager/types.ts",
  "trait_manager/types.ts",
].map((p) => `${SRC_PREFIX}${p}`)

type Args = {
  dryRun: boolean
  /** If true, discover all `*types.ts` files in the repo at runtime. */
  discover: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, discover: false }
  for (const a of argv) {
    if (a === "--dry-run") args.dryRun = true
    else if (a === "--discover") args.discover = true
  }
  return args
}

async function discoverTypePaths(src: GithubMarkdownSource): Promise<string[]> {
  // Reuse listMarkdownFiles' tree-walk by calling the GitHub API
  // ourselves — listMarkdownFiles filters to .md/.mdx, which we don't want.
  const ref = src.ref ?? "main"
  const url = `https://api.github.com/repos/${src.owner}/${src.repo}/git/trees/${ref}?recursive=1`
  const headers: Record<string, string> = {
    "user-agent": "tripcart-page-builder-rag-ingest/0.1",
    accept: "application/vnd.github+json",
  }
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  const res = await fetch(url, { headers })
  if (!res.ok) {
    throw new Error(`[github] tree fetch failed: ${res.status}`)
  }
  const data = (await res.json()) as {
    tree: { path: string; type: string }[]
  }
  return data.tree
    .filter((t) => t.type === "blob")
    .map((t) => t.path)
    .filter((p) => p.startsWith(SRC_PREFIX) && /(?:^|\/)types\.ts$/.test(p))
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  console.log(
    `\n[ingest:source] starting (${args.dryRun ? "DRY RUN" : "live"}${args.discover ? ", discover mode" : ""})\n`
  )

  const paths = args.discover ? await discoverTypePaths(SOURCE) : SOURCE_PATHS

  console.log(
    `[ingest:source] processing ${paths.length} files from ${SOURCE.owner}/${SOURCE.repo}@${SOURCE.ref}\n`
  )

  if (paths.length === 0) {
    // Touch listMarkdownFiles import to keep type-aware tooling happy in case
    // we drop discover mode later. Real callers don't need this.
    void listMarkdownFiles
    console.warn("[ingest:source] no files — aborting")
    return
  }

  console.log("[ingest:source] fetching pages…")
  const cleanedPages: CleanedPage[] = []
  for (const path of paths) {
    const page = await fetchSourcePage(SOURCE, path, {
      titleStripPrefix: SRC_PREFIX,
    })
    if (page) {
      cleanedPages.push(page)
      console.log(`  fetched: ${path}`)
    }
  }
  console.log(`[ingest:source] cleaned ${cleanedPages.length} pages\n`)

  console.log("[ingest:source] splitting…")
  const chunks: Chunk[] = []
  for (const page of cleanedPages) {
    const pageChunks = await splitMarkdown(page)
    chunks.push(...pageChunks)
  }
  console.log(`[ingest:source] produced ${chunks.length} chunks\n`)

  if (chunks.length === 0) {
    console.warn("[ingest:source] no chunks produced — aborting")
    return
  }

  if (args.dryRun) {
    console.log("[ingest:source] DRY RUN — sample chunks:\n")
    for (const c of chunks.slice(0, 5)) {
      const preview = c.content.slice(0, 200).replace(/\n/g, " ")
      console.log(
        `  [${c.kind}] ${c.headerPath}  (${c.tokenCount} tok)\n    ${c.sourceUrl}\n    ${preview}…\n`
      )
    }
    console.log(
      "[ingest:source] dry run complete — no DB writes, no embedding calls."
    )
    return
  }

  console.log("[ingest:source] checking which chunks need embedding…")
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
    console.log("[ingest:source] embedding…")
    const embeddings = await embedBatch(newChunks.map((c) => c.content))
    console.log("[ingest:source] inserting chunks…")
    const inserted = await insertChunks(newChunks, embeddings)
    console.log(`         inserted ${inserted}\n`)
  }

  console.log("[ingest:source] upserting chunk→url rows…")
  const touched = await upsertChunkUrls(chunks)
  console.log(`         touched ${touched}\n`)

  console.log("[ingest:source] done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
