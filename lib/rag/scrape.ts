import * as cheerio from "cheerio"
import PQueue from "p-queue"

export type RawPage = {
  url: string
  html: string
  fetchedAt: string
}

type CrawlOptions = {
  rootUrl: string
  pathPrefix: string
  concurrency?: number
  delayMs?: number
  maxPages?: number
  userAgent?: string
  onPage?: (url: string, total: number) => void
}

const DEFAULT_USER_AGENT =
  "tripcart-page-builder-rag-ingest/0.1 (+https://github.com/tripcart)"

function normaliseUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base)
    if (u.protocol !== "https:" && u.protocol !== "http:") return null
    u.hash = ""
    u.search = ""
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1)
    }
    return u.toString()
  } catch {
    return null
  }
}

function extractLinks(html: string, base: string): string[] {
  const $ = cheerio.load(html)
  const out: string[] = []
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")
    if (!href) return
    const norm = normaliseUrl(href, base)
    if (norm) out.push(norm)
  })
  return out
}

export async function crawlDocs(opts: CrawlOptions): Promise<RawPage[]> {
  const {
    rootUrl,
    pathPrefix,
    concurrency = 4,
    delayMs = 600,
    maxPages = 500,
    userAgent = DEFAULT_USER_AGENT,
    onPage,
  } = opts

  const origin = new URL(rootUrl).origin
  const root = normaliseUrl(rootUrl, rootUrl)
  if (!root) throw new Error(`Invalid rootUrl: ${rootUrl}`)

  // Accept the prefix exactly (without trailing slash) OR as a real path
  // prefix. Avoids matching unrelated paths like /docs-archive while still
  // accepting the seed URL after trailing-slash normalisation.
  const prefixNoSlash = pathPrefix.replace(/\/$/, "")
  const matchesPrefix = (path: string): boolean =>
    path === prefixNoSlash || path.startsWith(`${prefixNoSlash}/`)

  const visited = new Set<string>()
  const queued = new Set<string>()
  const pages: RawPage[] = []

  const queue = new PQueue({ concurrency })

  const enqueue = (url: string) => {
    if (queued.has(url) || visited.has(url)) return
    const u = new URL(url)
    if (u.origin !== origin) return
    if (!matchesPrefix(u.pathname)) return
    queued.add(url)
    void queue.add(() => visit(url))
  }

  async function visit(url: string): Promise<void> {
    if (visited.has(url)) return
    if (pages.length >= maxPages) return
    visited.add(url)

    if (delayMs > 0) {
      const jitter = Math.floor(Math.random() * delayMs * 0.5)
      await new Promise((r) => setTimeout(r, delayMs + jitter))
    }

    let html: string
    try {
      const res = await fetch(url, {
        headers: { "user-agent": userAgent, accept: "text/html" },
        redirect: "follow",
      })
      if (!res.ok) {
        console.warn(`[scrape] ${res.status} ${url}`)
        return
      }
      const contentType = res.headers.get("content-type") ?? ""
      if (!contentType.includes("text/html")) return
      html = await res.text()
    } catch (err) {
      console.warn(
        `[scrape] fetch failed for ${url}: ${(err as Error).message}`
      )
      return
    }

    pages.push({ url, html, fetchedAt: new Date().toISOString() })
    onPage?.(url, pages.length)

    for (const link of extractLinks(html, url)) {
      enqueue(link)
    }
  }

  enqueue(root)
  await queue.onIdle()

  return pages
}
