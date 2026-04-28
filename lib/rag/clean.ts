import * as cheerio from "cheerio"
// @ts-expect-error — package ships no types but is widely used.
import { gfm } from "@joplin/turndown-plugin-gfm"
import TurndownService from "turndown"

import type { RawPage } from "./scrape"

export type CleanedPage = {
  url: string
  title: string
  markdown: string
  kind: "api" | "narrative"
}

const MAIN_SELECTORS = [
  "main .vp-doc",
  "main .content",
  "article",
  "main",
  "body",
]

const STRIP_SELECTORS = [
  "nav",
  "aside",
  "footer",
  "header",
  "script",
  "style",
  "noscript",
  "[class*=sidebar]",
  "[class*=Sidebar]",
  "[class*=navbar]",
  "[class*=Navbar]",
  "[aria-hidden=true]",
  ".vp-back-to-top",
  ".vp-doc-footer",
  ".vp-doc-footer-last-updated",
  ".edit-link",
  ".prev-next",
  // VitePress-style anchor markers and external-link icons render as visible
  // `#` and "(opens new window)" text in markdown otherwise.
  ".header-anchor",
  ".OutboundLink",
  ".outbound-link",
  "a[aria-label='Permalink']",
]

function buildTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    fence: "```",
    bulletListMarker: "-",
    emDelimiter: "_",
    strongDelimiter: "**",
    linkStyle: "inlined",
  })
  td.use(gfm)
  return td
}

const turndown = buildTurndown()

function pickMain($: cheerio.CheerioAPI) {
  for (const sel of MAIN_SELECTORS) {
    const node = $(sel).first()
    if (node.length && node.text().trim().length > 100) return node
  }
  return $("body")
}

function classify(url: string): "api" | "narrative" {
  return new URL(url).pathname.startsWith("/docs/api") ? "api" : "narrative"
}

export function htmlToMarkdown(page: RawPage): CleanedPage {
  const $ = cheerio.load(page.html)

  STRIP_SELECTORS.forEach((sel) => $(sel).remove())

  const main = pickMain($)
  const html = $.html(main)

  const title =
    $("title").first().text().trim() ||
    main.find("h1").first().text().trim() ||
    new URL(page.url).pathname

  const markdown = turndown
    .turndown(html)
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return {
    url: page.url,
    title,
    markdown,
    kind: classify(page.url),
  }
}
