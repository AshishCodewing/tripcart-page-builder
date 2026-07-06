// Server-only: builds the cache-tiered copilot prompt. `LangfuseClient` uses the
// secret key, so this module must never be imported from a client component —
// it is imported only by app/api/chat/route.ts.
import { LangfuseClient } from "@langfuse/client"
import type { SystemPrompt } from "@tanstack/ai"
import type { OpenRouterSystemPromptMetadata } from "@tanstack/ai-openrouter"

export const COPILOT_PROMPT_NAME = "page-builder-copilot"
export const COPILOT_PROMPT_LABEL = "production"

// Used when the Langfuse prompt config carries no model override. Cheap chat
// orchestrator (plan 017) — code generation runs on a stronger model behind
// /api/generate (see lib/ai/codegen.ts).
export const COPILOT_DEFAULT_MODEL = "openai/gpt-5-mini"

// Minimal fallback, used only when Langfuse is unreachable or the prompt has not
// been authored yet. A condensed version of the chat-first copilot persona that
// lives in the Langfuse UI (name: page-builder-copilot, label: production).
export const COPILOT_FALLBACK_PROMPT = `You are an AI assistant specialized in web design, embedded in the TripCart
page builder, a GrapesJS-based no-code website editor.
The page's exported HTML/CSS, devices, and the user's selection are provided
in the system context below. Base every answer on that real state — never
invent elements, styles, or pages not present in it. Suggest concrete,
actionable changes the user can apply in the editor.
Reply in concise Markdown. Refuse requests unrelated to the user's website.`

// Reads LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY / LANGFUSE_BASE_URL from env.
const langfuse = new LangfuseClient()

export type CopilotPrompt = {
  text: string
  name: string
  version: number
  isFallback: boolean
  /** Model id from the prompt's Langfuse config, else the default. */
  model: string
}

/**
 * Fetches the static copilot system prompt from Langfuse.
 *
 * `cacheTtlSeconds` keeps the fetched prompt in-process so we don't hit the
 * Langfuse API on every request (stale entries revalidate in the background);
 * `fallback` guarantees the route works even if Langfuse is down or the prompt
 * has not been created yet (`isFallback` will be true).
 */
export async function fetchCopilotPrompt(): Promise<CopilotPrompt> {
  const prompt = await langfuse.prompt.get(COPILOT_PROMPT_NAME, {
    label: COPILOT_PROMPT_LABEL,
    type: "text",
    cacheTtlSeconds: 300,
    fallback: COPILOT_FALLBACK_PROMPT,
  })
  const configModel = (prompt.config as { model?: unknown } | null)?.model
  return {
    text: prompt.prompt,
    name: prompt.name,
    version: prompt.version,
    isFallback: prompt.isFallback,
    model:
      typeof configModel === "string" ? configModel : COPILOT_DEFAULT_MODEL,
  }
}

// Shape of the editor context the client sends: the page's exported HTML/CSS
// plus slim selection/device state. Built by gatherEditorContext in
// components/ai/chat.tsx — keep the two in sync. Every field stays optional
// because the client gathers each one resiliently and omits failures.
export type EditorContext = {
  pageHtml?: string
  pageCss?: string
  selectedComponent?: { id: string; html: string } | null
  selectedIds?: string[]
  currentPage?: { id: string; name: string } | null
  devices?: Array<{ name?: string; width?: string; widthMedia?: string }>
  isNewProject?: boolean
}

const EPHEMERAL: OpenRouterSystemPromptMetadata = {
  cache_control: { type: "ephemeral" },
}

function block(heading: string, value: unknown): string {
  const body = typeof value === "string" ? value : JSON.stringify(value)
  return `## ${heading}\n${body}`
}

function fencedBlock(heading: string, lang: string, code: string): string {
  return `## ${heading}\n\`\`\`${lang}\n${code}\n\`\`\``
}

/**
 * Builds the cache-tiered system prompt array, ordered most-stable-first:
 *   tier 0 — static copilot prompt          → cache_control: ephemeral
 *   tier 1 — page HTML/CSS export + devices → cache_control: ephemeral
 *   tier 2 — selection / UI (volatile)      → no cache_control
 *
 * Only `systemPrompts` carry `cache_control` through the OpenRouter adapter, so
 * all cacheable context lives here; the user's turn stays in `messages`. Placing
 * the volatile tier last keeps the tier-0/tier-1 prefix byte-identical across
 * requests so its cache breakpoints keep hitting.
 */
export function buildCopilotSystemPrompts(
  promptText: string,
  ctx: EditorContext = {}
): Array<SystemPrompt<OpenRouterSystemPromptMetadata>> {
  const prompts: Array<SystemPrompt<OpenRouterSystemPromptMetadata>> = [
    { content: promptText, metadata: EPHEMERAL },
  ]

  // Tier 1 — the page export, byte-stable until the site itself is edited.
  const projectParts: string[] = []
  if (ctx.pageHtml)
    projectParts.push(fencedBlock("Page HTML", "html", ctx.pageHtml))
  if (ctx.pageCss)
    projectParts.push(fencedBlock("Page CSS", "css", ctx.pageCss))
  if (ctx.devices?.length) projectParts.push(block("Devices", ctx.devices))
  if (projectParts.length > 0) {
    prompts.push({
      content: `# Current website state\n${projectParts.join("\n\n")}`,
      metadata: EPHEMERAL,
    })
  }

  // Tier 2 — volatile selection/UI state, intentionally left uncached.
  const volatileParts: string[] = []
  if (ctx.currentPage)
    volatileParts.push(block("Current Page", ctx.currentPage))
  if (ctx.selectedComponent)
    volatileParts.push(
      fencedBlock(
        `Selected Component (id: ${ctx.selectedComponent.id})`,
        "html",
        ctx.selectedComponent.html
      )
    )
  if (ctx.selectedIds?.length)
    volatileParts.push(block("All Selected Component IDs", ctx.selectedIds))
  if (ctx.isNewProject !== undefined)
    volatileParts.push(block("Is New Project (empty canvas)", ctx.isNewProject))
  if (volatileParts.length > 0) {
    prompts.push({
      content: `# Current selection\n${volatileParts.join("\n\n")}`,
    })
  }

  return prompts
}
