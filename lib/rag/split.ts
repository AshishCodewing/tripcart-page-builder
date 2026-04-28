import { createHash } from "node:crypto"

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { encode } from "gpt-tokenizer"

import type { CleanedPage } from "./clean"

export type Chunk = {
  content: string
  contentHash: string
  headerPath: string
  kind: "api" | "narrative"
  tokenCount: number
  sourceUrl: string
  sourceTitle: string
}

const NARRATIVE_TOKEN_TARGET = 600
const NARRATIVE_OVERLAP_TOKENS = 80
const NARRATIVE_CHAR_PER_TOKEN = 4 // recursive splitter sizes by char.

const FENCE_RE = /```[\s\S]*?```/g
const FENCE_PLACEHOLDER = (i: number) => `__FENCE_${i}__`

const sizeCapSplitter = RecursiveCharacterTextSplitter.fromLanguage(
  "markdown",
  {
    chunkSize: NARRATIVE_TOKEN_TARGET * NARRATIVE_CHAR_PER_TOKEN,
    chunkOverlap: NARRATIVE_OVERLAP_TOKENS * NARRATIVE_CHAR_PER_TOKEN,
  },
)

function tokenCount(text: string): number {
  return encode(text).length
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

type HeaderMeta = {
  h1?: string
  h2?: string
  h3?: string
}

type HeaderSection = {
  headers: HeaderMeta
  text: string
}

/**
 * Split markdown on `#`/`##`/`###` headings while ignoring lines inside
 * fenced code blocks. Returns one section per heading, plus a possible
 * preamble before the first heading. Each section carries the header
 * tuple in scope when it started.
 *
 * Why custom: @langchain/textsplitters v1 does not export
 * `MarkdownHeaderTextSplitter` (Python-only). A native implementation is
 * also the cleanest way to guarantee `# foo` inside a fence won't false-split.
 */
function splitByHeaders(
  markdown: string,
  maxLevel = 3,
): HeaderSection[] {
  const lines = markdown.split("\n")
  const sections: HeaderSection[] = []
  const stack: (string | undefined)[] = [undefined, undefined, undefined]
  let buf: string[] = []
  let inFence = false

  const currentMeta = (): HeaderMeta => ({
    h1: stack[0],
    h2: stack[1],
    h3: stack[2],
  })

  const flush = () => {
    if (buf.length === 0) return
    const text = buf.join("\n").trim()
    if (text) sections.push({ headers: currentMeta(), text })
    buf = []
  }

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence
      buf.push(line)
      continue
    }
    if (!inFence) {
      const m = /^(#{1,6})\s+(.*\S)\s*$/.exec(line)
      if (m && m[1].length <= maxLevel) {
        flush()
        const level = m[1].length
        const title = m[2].trim()
        stack[level - 1] = title
        for (let i = level; i < stack.length; i++) stack[i] = undefined
        buf.push(line) // include the heading itself in the next chunk
        continue
      }
    }
    buf.push(line)
  }
  flush()

  return sections
}

function buildHeaderPath(pageTitle: string, meta: HeaderMeta): string {
  const parts = [meta.h1, meta.h2, meta.h3].filter(
    (s): s is string => !!s && s.trim().length > 0,
  )
  if (parts.length === 0) return pageTitle
  return parts.join(" > ")
}

type ProtectedSplit = {
  text: string
  fences: string[]
}

function protectFences(markdown: string): ProtectedSplit {
  const fences: string[] = []
  const text = markdown.replace(FENCE_RE, (m) => {
    fences.push(m)
    return FENCE_PLACEHOLDER(fences.length - 1)
  })
  return { text, fences }
}

function restoreFences(text: string, fences: string[]): string {
  return text.replace(/__FENCE_(\d+)__/g, (_, n) => fences[Number(n)] ?? "")
}

function makeChunk(
  content: string,
  headerPath: string,
  page: CleanedPage,
): Chunk {
  const trimmed = content.trim()
  return {
    content: trimmed,
    contentHash: sha256(`${page.kind}:${trimmed}`),
    headerPath,
    kind: page.kind,
    tokenCount: tokenCount(trimmed),
    sourceUrl: page.url,
    sourceTitle: page.title,
  }
}

async function splitNarrative(page: CleanedPage): Promise<Chunk[]> {
  const sections = splitByHeaders(page.markdown, 3)
  const out: Chunk[] = []

  for (const section of sections) {
    const headerPath = buildHeaderPath(page.title, section.headers)

    if (tokenCount(section.text) <= NARRATIVE_TOKEN_TARGET * 1.4) {
      out.push(makeChunk(section.text, headerPath, page))
      continue
    }

    // Section is too large — protect fences, recursively split the
    // placeholder version, then restore. Fences stay intact because the
    // placeholder is a short opaque token to the recursive splitter.
    const protectedSplit = protectFences(section.text)
    const subTexts = await sizeCapSplitter.splitText(protectedSplit.text)
    for (const sub of subTexts) {
      const restored = restoreFences(sub, protectedSplit.fences).trim()
      if (restored) out.push(makeChunk(restored, headerPath, page))
    }
  }

  return out
}

async function splitApi(page: CleanedPage): Promise<Chunk[]> {
  // For API pages we want one chunk per method, so split only on h1/h2.
  const sections = splitByHeaders(page.markdown, 2)
  const out: Chunk[] = []
  for (const section of sections) {
    const headerPath = buildHeaderPath(page.title, section.headers)
    if (section.text.trim()) {
      out.push(makeChunk(section.text, headerPath, page))
    }
  }
  return out
}

export async function splitMarkdown(page: CleanedPage): Promise<Chunk[]> {
  if (!page.markdown.trim()) return []
  const chunks =
    page.kind === "api" ? await splitApi(page) : await splitNarrative(page)
  // Drop heading-only or whitespace-only chunks: Google's embedding API
  // returns a zero-dim vector for empty/whitespace input, which pgvector
  // refuses to store.
  return chunks.filter((c) => c.content.replace(/^#+\s*.*$/gm, "").trim())
}
