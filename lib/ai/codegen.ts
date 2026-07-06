// Server-only: builds the code-generation prompt for /api/generate. Uses the
// Langfuse secret key via `LangfuseClient`, so this module must never be
// imported from a client component.
import { LangfuseClient } from "@langfuse/client"
import type { SystemPrompt } from "@tanstack/ai"
import type { OpenRouterSystemPromptMetadata } from "@tanstack/ai-openrouter"

export const CODEGEN_PROMPT_NAME = "page-builder-codegen"
export const CODEGEN_PROMPT_LABEL = "production"

// Used when the Langfuse prompt config carries no model override.
export const CODEGEN_DEFAULT_MODEL = "openai/gpt-5.1"

export const GENERATED_CODE_TAG = "generated_code"

// Full guardrail text, not a stub: code generation without these rules
// produces markup that breaks the Style Manager and the drag sorter, so the
// fallback must be complete enough to run the product. The Langfuse prompt
// (name: page-builder-codegen, label: production) takes precedence once
// authored — keep the two in sync when editing.
export const CODEGEN_FALLBACK_PROMPT = `You are the code-generation agent of the TripCart page builder, a no-code
website editor based on GrapesJS. You receive a plan and the current page
code, and you output production-quality HTML/CSS that is applied directly to
the page.

## Design guidelines
- Be creative with fonts, layouts and content. Be detailed and make it functional.
- Match the design language of the existing page: reuse its fonts, colors, spacing and section patterns.
- Use subtle contrast, appropriate design styles and color palette; add subtle dividers and outlines where appropriate.
- For form inputs prefer custom styles but keep them accessible.
- Add hover color and outline interactions.

## Media guidelines
- Ensure purpose-driven visuals and consistency in visual tone; align the image subject to the content.
- Use lazy loading below the fold and optimized sizes.
- Never use srcset. Ensure media is fluid and responsive (e.g. 'object-fit: cover').
- Prefer image URLs already present in the page; otherwise use https://images.unsplash.com URLs.

## Icons
- Avoid raw SVG and emojis.
- Prefer lucide icons via the Iconify API: https://api.iconify.design/lucide-{ICON_NAME}.svg?color={COLOR}
  - Default color is black; match the nearby text color inside links/buttons.

## CSS rules
- Include all new CSS in a single <style> element as the FIRST child of your output.
- Reuse existing CSS classes and CSS variables from the current page (including theme variables) as much as possible; NEVER redefine or edit existing rules.
- New rules must use ONLY single flat classes: '.new-cls1 {...} .new-cls2 {...}'.
- NEVER use nested or complex selectors: no '.a .b', '.a > .b', '.a[attr]', '#id .cls'.
- Desktop-first. Only use the media queries explicitly listed in the context, if any are listed.

## Output contract
- Add a human-readable 'data-gjs-name' attribute to every new element; make it semantic and role-based (e.g. <ul data-gjs-name="Menu Card">). Repeated structures may share the same name.
- Wrap ALL text content in an element (p, span, h1-h6, a, li, ...) — never leave bare text as the only child of a structural element.
- Do not include <script> elements.
- NEVER include comments, backticks, markdown or explanations.
- Wrap the entire output inside a single <${GENERATED_CODE_TAG}> tag and output NOTHING outside it.`

// Reads LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY / LANGFUSE_BASE_URL from env.
const langfuse = new LangfuseClient()

export type CodegenPrompt = {
  text: string
  name: string
  version: number
  isFallback: boolean
  /** Model id from the prompt's Langfuse config, else the default. */
  model: string
}

/**
 * Fetches the static code-generation prompt from Langfuse (same caching and
 * fallback behavior as fetchCopilotPrompt). The prompt's `config.model` lets
 * the code-gen model be swapped from the Langfuse UI without a deploy.
 */
export async function fetchCodegenPrompt(): Promise<CodegenPrompt> {
  const prompt = await langfuse.prompt.get(CODEGEN_PROMPT_NAME, {
    label: CODEGEN_PROMPT_LABEL,
    type: "text",
    cacheTtlSeconds: 300,
    fallback: CODEGEN_FALLBACK_PROMPT,
  })
  const configModel = (prompt.config as { model?: unknown } | null)?.model
  return {
    text: prompt.prompt,
    name: prompt.name,
    version: prompt.version,
    isFallback: prompt.isFallback,
    model:
      typeof configModel === "string" ? configModel : CODEGEN_DEFAULT_MODEL,
  }
}

export type CodegenAction = "create" | "add" | "edit"

export type CodegenPosition =
  | "before"
  | "beforeInside"
  | "afterInside"
  | "after"

/** Body of POST /api/generate, sent by the client tool handlers with fresh
 * editor state at tool-execution time (see lib/ai/tools.ts). */
export type CodegenRequest = {
  action: CodegenAction
  /** The orchestrator's high-level plan for what to build/change. */
  plan: string
  /** Last user message, for tone/intent context. */
  userMessage?: string
  pageHtml?: string
  pageCss?: string
  /** edit: selected component ids. add: single target component id. */
  targetIds?: string[]
  /** add only: where to place the new element relative to the target. */
  position?: CodegenPosition
  /** add only: orchestrator-chosen name for the new component. */
  componentName?: string
  devices?: Array<{ name?: string; width?: string; widthMedia?: string }>
  /** Chat thread id, reused as the Langfuse session id. */
  threadId?: string
}

const EPHEMERAL: OpenRouterSystemPromptMetadata = {
  cache_control: { type: "ephemeral" },
}

const ACTION_PREAMBLES: Record<CodegenAction, string> = {
  create: `# Task: create page content
The page is currently empty. Create the full content for it: a complete,
coherent set of sections implementing the plan. Output a single <style>
element followed by the top-level sections. Do NOT output <html>, <head>,
<body> or a doctype — only body content.`,
  add: `# Task: add new elements
Add new HTML elements to the existing page.
- NEVER output elements that already exist in the page — only the new,
  self-contained element(s), ready to be inserted at the target position.
- New elements don't need id attributes.`,
  edit: `# Task: edit existing elements
Edit existing HTML elements of the page.
- Output ONLY the edited elements, nothing else. NEVER rewrite the entire page.
- An output element whose id matches an existing element REPLACES that
  element entirely: include ALL children you want to keep — children you
  don't include are removed.
- New inner elements don't need id attributes.`,
}

function fenced(lang: string, code: string): string {
  return `\`\`\`${lang}\n${code}\n\`\`\``
}

/** Allowed media queries derived from the editor's device list; the first
 * (largest) device styles all screens, so it contributes no query. */
function mediaQuerySection(devices: CodegenRequest["devices"]): string {
  const queries = (devices ?? [])
    .filter((d) => d.widthMedia)
    .map((d) => `@media (max-width: ${d.widthMedia}) { /* ${d.name ?? ""} */ }`)
  if (queries.length === 0) return ""
  return `## Allowed media queries
The ONLY media queries you may use (desktop-first):
${fenced("css", queries.join("\n"))}`
}

/**
 * Cache-tiered system prompts for the code-gen call, same ordering principle
 * as buildCopilotSystemPrompts: static guardrails first (cached), volatile
 * task/page context last. gpt-5.x caches prefixes implicitly; the explicit
 * cache_control breakpoint is forwarded by the OpenRouter adapter and is
 * harmless where unsupported.
 */
export function buildCodegenSystemPrompts(
  promptText: string,
  req: CodegenRequest
): Array<SystemPrompt<OpenRouterSystemPromptMetadata>> {
  const parts: string[] = [ACTION_PREAMBLES[req.action]]

  if (req.action === "add" && req.targetIds?.length) {
    parts.push(
      `## Target position
Insert the new element(s) ${req.position ?? "afterInside"} the element with id "${req.targetIds[0]}".` +
        (req.componentName ? `\nNew component name: ${req.componentName}` : "")
    )
  }
  if (req.action === "edit" && req.targetIds?.length) {
    parts.push(`SELECTED_COMPONENT_IDS: ${req.targetIds.join(", ")}`)
  }

  const mq = mediaQuerySection(req.devices)
  if (mq) parts.push(mq)

  const current: string[] = []
  if (req.pageHtml)
    current.push(`## Current page HTML\n${fenced("html", req.pageHtml)}`)
  if (req.pageCss)
    current.push(`## Current page CSS\n${fenced("css", req.pageCss)}`)
  if (current.length) parts.push(`# CURRENT_CODE\n${current.join("\n\n")}`)

  return [
    { content: promptText, metadata: EPHEMERAL },
    { content: parts.join("\n\n") },
  ]
}

/** The generation conversation: the user's request plus a synthetic assistant
 * message carrying the orchestrator's plan (Studio SDK pattern — the plan
 * reads as the agent's own intention, which the completion then executes). */
export function buildCodegenMessages(req: CodegenRequest) {
  return [
    {
      role: "user" as const,
      content: req.userMessage?.trim() || req.plan,
    },
    {
      role: "assistant" as const,
      content: `Plan: ${req.plan}`,
    },
  ]
}

/** Extracts the payload of the <generated_code> sentinel tag; null when the
 * model failed the output contract (caller retries once, then errors). */
export function parseGeneratedCode(text: string): string | null {
  const match = text.match(
    new RegExp(`<${GENERATED_CODE_TAG}>([\\s\\S]*?)</${GENERATED_CODE_TAG}>`)
  )
  const inner = match?.[1]?.trim()
  return inner ? inner : null
}
