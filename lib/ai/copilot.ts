// Server-only: builds the cache-tiered copilot prompt. `LangfuseClient` uses the
// secret key, so this module must never be imported from a client component —
// it is imported only by app/api/chat/route.ts.
import { LangfuseClient } from "@langfuse/client"
import type { SystemPrompt } from "@tanstack/ai"
import type { OpenRouterSystemPromptMetadata } from "@tanstack/ai-openrouter"
import { z } from "zod"

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

// Schema for the editor context the client sends: the page's exported HTML/CSS
// plus slim selection/device state. Built by gatherEditorContext in
// components/ai/chat.tsx — keep the two in sync. Every field stays optional
// because the client gathers each one resiliently and omits failures. The
// route validates untrusted input against this before it reaches the prompt.
//
// Caps mirror /api/generate's bodySchema (400k page code, 10 devices) plus
// sane bounds on the selection fields. The client stays comfortably under all
// of them. `nullish()` (not `nullable()`): the client sends `null` for an empty
// selection and omits failed fields entirely.
export const editorContextSchema = z.object({
  pageHtml: z.string().max(400_000).optional(),
  pageCss: z.string().max(400_000).optional(),
  selectedComponent: z
    .object({ id: z.string().max(200), html: z.string().max(400_000) })
    .nullish(),
  selectedIds: z.array(z.string().max(200)).max(50).optional(),
  currentPage: z
    .object({ id: z.string().max(200), name: z.string().max(500) })
    .nullish(),
  devices: z
    .array(
      z.object({
        name: z.string().max(200).optional(),
        width: z.string().max(50).optional(),
        widthMedia: z.string().max(50).optional(),
      })
    )
    .max(10)
    .optional(),
  isNewProject: z.boolean().optional(),
})

export type EditorContext = z.infer<typeof editorContextSchema>

const EPHEMERAL: OpenRouterSystemPromptMetadata = {
  cache_control: { type: "ephemeral" },
}

// The selected component's markup also exists inside the tier-1 page HTML
// (addressable by id), so beyond this size we send only the id reference —
// small selections keep answer quality, large ones are pure duplicate cost.
const MAX_SELECTED_HTML_CHARS = 4000

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
  if (ctx.selectedComponent) {
    const { id, html } = ctx.selectedComponent
    volatileParts.push(
      html.length <= MAX_SELECTED_HTML_CHARS
        ? fencedBlock(`Selected Component (id: ${id})`, "html", html)
        : block(
            `Selected Component (id: ${id})`,
            `[markup omitted — ${html.length} chars; locate it by id in the Page HTML above]`
          )
    )
  }
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
