import type { CleanedPage } from "./clean"

export type GithubMarkdownSource = {
  owner: string
  repo: string
  ref?: string
  excludePaths?: string[]
}

type GithubTreeItem = {
  path: string
  type: "blob" | "tree"
  size?: number
}

type GithubTreeResponse = {
  sha: string
  tree: GithubTreeItem[]
  truncated: boolean
}

const RAW_BASE = "https://raw.githubusercontent.com"
const BLOB_BASE = "https://github.com"
const API_BASE = "https://api.github.com"

const DEFAULT_USER_AGENT =
  "tripcart-page-builder-rag-ingest/0.1 (+https://github.com/tripcart)"

function authHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = {
    "user-agent": DEFAULT_USER_AGENT,
    accept: "application/vnd.github+json",
  }
  if (token) headers.authorization = `Bearer ${token}`
  return headers
}

function isExcluded(path: string, excludePaths: string[]): boolean {
  return excludePaths.some((ex) => path === ex || path.startsWith(`${ex}/`))
}

export async function listMarkdownFiles(
  src: GithubMarkdownSource
): Promise<string[]> {
  const ref = src.ref ?? "main"
  const url = `${API_BASE}/repos/${src.owner}/${src.repo}/git/trees/${ref}?recursive=1`
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) {
    throw new Error(
      `[github] tree fetch failed: ${res.status} ${res.statusText} (${url})`
    )
  }
  const data = (await res.json()) as GithubTreeResponse
  if (data.truncated) {
    console.warn(
      "[github] tree response was truncated — some files may be missed"
    )
  }

  const exclude = src.excludePaths ?? []
  return data.tree
    .filter((item) => item.type === "blob")
    .map((item) => item.path)
    .filter((p) => /\.mdx?$/i.test(p))
    .filter((p) => !isExcluded(p, exclude))
}

function extractTitle(markdown: string, fallback: string): string {
  const m = /^#\s+(.+)$/m.exec(markdown)
  return (m ? m[1].trim() : fallback) || fallback
}

export async function fetchMarkdownPage(
  src: GithubMarkdownSource,
  path: string
): Promise<CleanedPage | null> {
  const ref = src.ref ?? "main"
  const rawUrl = `${RAW_BASE}/${src.owner}/${src.repo}/${ref}/${path}`
  const blobUrl = `${BLOB_BASE}/${src.owner}/${src.repo}/blob/${ref}/${path}`

  const res = await fetch(rawUrl, {
    headers: { "user-agent": DEFAULT_USER_AGENT },
  })
  if (!res.ok) {
    console.warn(`[github] ${res.status} ${rawUrl}`)
    return null
  }
  const markdown = (await res.text()).trim()
  if (!markdown) return null

  return {
    url: blobUrl,
    title: extractTitle(markdown, path),
    markdown,
    kind: "narrative",
  }
}

export type SourcePageOptions = {
  /** Code fence language (default: derived from extension). */
  language?: string
  /** Strip a leading repo subpath from the title (e.g. "packages/core/src/"). */
  titleStripPrefix?: string
}

const EXT_TO_LANG: Record<string, string> = {
  ts: "ts",
  tsx: "tsx",
  js: "js",
  jsx: "jsx",
  mjs: "js",
  cjs: "js",
}

function deriveLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  return EXT_TO_LANG[ext] ?? ext
}

function deriveSourceTitle(path: string, stripPrefix?: string): string {
  const stripped =
    stripPrefix && path.startsWith(stripPrefix)
      ? path.slice(stripPrefix.length)
      : path
  return stripped.replace(/\.[^./]+$/, "")
}

/**
 * Fetch a non-markdown source file (e.g. .ts, .tsx) and wrap it as
 * markdown so the existing chunker handles it. The splitter's fence
 * protection keeps code intact when size-capping kicks in.
 */
export async function fetchSourcePage(
  src: GithubMarkdownSource,
  path: string,
  options: SourcePageOptions = {}
): Promise<CleanedPage | null> {
  const ref = src.ref ?? "main"
  const rawUrl = `${RAW_BASE}/${src.owner}/${src.repo}/${ref}/${path}`
  const blobUrl = `${BLOB_BASE}/${src.owner}/${src.repo}/blob/${ref}/${path}`

  const res = await fetch(rawUrl, {
    headers: { "user-agent": DEFAULT_USER_AGENT },
  })
  if (!res.ok) {
    console.warn(`[github] ${res.status} ${rawUrl}`)
    return null
  }
  const code = (await res.text()).trim()
  if (!code) return null

  const lang = options.language ?? deriveLanguage(path)
  const title = deriveSourceTitle(path, options.titleStripPrefix)

  const markdown = `# ${title}\n\n\`${path}\`\n\n\`\`\`${lang}\n${code}\n\`\`\``

  return {
    url: blobUrl,
    title,
    markdown,
    kind: "narrative",
  }
}
