# Plan 017: Copilot tools & code-gen orchestration (plan 016 Phase 4)

> **Status: IMPLEMENTED & VERIFIED E2E (2026-07-06).** All five steps done;
> two user-side items remain: paste `page-builder-codegen` v1 and
> `page-builder-copilot` v3 into Langfuse (in-repo fallbacks are identical,
> so the product runs correctly meanwhile — the v3 Tool-behavior section
> matters: in testing, v2-without-it once wrote a page spec into chat instead
> of calling generatePage until nudged). E2E results: add (testimonials,
> pure design-system reuse, zero new CSS rules), approval-gated edit +
> remove (deny leaves page untouched), generatePage on empty canvas (4
> sections, theme fonts; second same-turn call correctly refused by the
> not-empty guard), advice-only answers without tools, one Ctrl+Z reverts an
> AI change. Traces: `page-builder-assistant` (gpt-5-mini) +
> `page-builder-codegen` (gpt-5.1) with real implicit-cache hits
> (2.5k–6.8k cached input tokens vs minimax's flat 128). Models follow the
> Studio SDK's documented pairing: orchestrator `openai/gpt-5-mini`, code-gen
> `openai/gpt-5.1` (verified on OpenRouter: mini $0.25/M in · $2/M out; 5.1
> $1.25/M in · $10/M out). Branch `feat/ai-assistant`.
>
> Effort: **L**. Depends on: plan 016 Phases 1–3 (shipped). Touches: new
> `app/api/generate/route.ts`, new `lib/ai/codegen.ts`, new
> `lib/ai/tools.ts`, new client apply util, `app/api/chat/route.ts`,
> `components/ai/chat.tsx`, two Langfuse prompts.

## Architecture: one orchestrator + one code-gen call per tool invocation

Two-tier, mirroring the Studio SDK's `model` / `agentCode.model` split, but
adapted to our stack (TanStack AI client tools instead of server-spawned
sub-streams):

```
user msg ─► /api/chat  chat()  openai/gpt-5-mini            [orchestrator]
              │  sees: v3 prompt + tier-1 page export + tier-2 selection
              │  never writes HTML; picks a tool, writes a short `plan`
              ▼
         tool call streamed to client (approval UI if needsApproval)
              ▼
         client tool handler (components/ai/…)
              │  code tools → POST /api/generate  openai/gpt-5.1  [code-gen]
              │       body: {action, plan, targetIds, pageHtml, pageCss,
              │              devices} — fresh from the editor at execute time
              │       server: page-builder-codegen prompt (Langfuse) +
              │               dynamic sections; returns <generated_code> HTML
              │  applies result to canvas by element ID (GrapesJS API,
              │  wrapped in one undo step)
              ▼
         tool result {success, summary} → orchestrator loop continues
              ▼
         orchestrator narrates what happened (maxIterations(6), already wired)
```

**Why client tools + a dedicated `/api/generate` endpoint** (instead of
Studio's server-side sub-stream + data-part streaming):

- Applying HTML to the canvas is inherently client-side (GrapesJS lives in
  the browser); the approval flow (`needsApproval` → `addToolApprovalResponse`)
  is already wired client-side in `chat.tsx`.
- A separate route gives the code-gen call its own model, its own Langfuse
  prompt/config, and its own generation trace — the clean 1-prompt-per-LLM-call
  structure agreed for prompt management.
- The client has the freshest editor state at tool-execution time (post-
  approval), so `CURRENT_CODE` can't go stale mid-turn.
- Cost: v1 applies the generated HTML on completion (no live canvas
  streaming). Studio-style progressive apply is a later enhancement.

## Tools (`lib/ai/tools.ts`, shared `toolDefinition` instances)

Code tools (each spawns one `/api/generate` call):

| Tool | Input | Code-gen action | Approval |
|---|---|---|---|
| `addComponent` | `name`, `plan`, `componentId` (target), `position: before\|beforeInside\|afterInside\|after` | "add" — new self-contained elements, never re-emit existing ones | no |
| `editComponent` | `plan` (+ selection IDs from editor at execute time) | "edit" — only changed elements, IDs mark updates, pass-children-or-removed semantics | yes (mutates existing content) |
| `generatePage` | `plan` | "create" — full page body; only valid when canvas is empty (`IS_PROJECT_EMPTY`) | no |

Simple tools (pure GrapesJS ops, no code-gen):

| Tool | Input | Approval |
|---|---|---|
| `removeComponent` | `componentId` | yes |
| `moveComponent` | `sourceId`, `targetId`, `targetIndex` | no (undoable) |

Omitted deliberately: `getPageContent` (page export is already inline in
tier 1 every turn — one page per project) and `listPages` / page-linking
(`page://`) — no multi-page. Tool descriptions copy Studio's ergonomics:
`plan` described as "high-level plan for the layout/structure, max ~1500
chars"; `addComponent`'s description tells the model the target `componentId`
comes from the element IDs visible in the page HTML context.

## Prompts (Langfuse)

**`page-builder-copilot` v3** (orchestrator; new version, `production` label
moved after maintainer review — same STOP gate as v2):
- v2 text + a `## Tool behavior` section: always narrate briefly before a
  tool call; prefer `editComponent` for changes to existing elements,
  `addComponent` for new content (target via element IDs from the context),
  `generatePage` only when the canvas is empty; never output raw HTML/CSS
  code blocks in chat when a tool can apply the change instead; for advice-
  only questions, answer in chat without tools.
- Config field carries `{ "model": "openai/gpt-5-mini" }` — route reads it,
  env/constant fallback.

**`page-builder-codegen` v1** (new text prompt; static guardrails only —
dynamic sections stay in code, same principle as the tier system):
- Adapted from the Studio SDK sections recorded in 016's appendix +
  `docs/reference/studio-sdk-prompt.md`: design guidelines, media guidelines,
  lucide icons via Iconify API, CSS in a single `<style>` with **flat single
  classes only** (validated by memory `feedback_grapesjs_flat_selectors`),
  desktop-first responsive, semantic `data-gjs-name` on every new element,
  output wrapped in a single `<generated_code>` tag with nothing outside it,
  never comments/backticks/markdown.
- Theme integration replaces Studio's `globalStyles` section: `pageCss`
  includes the tenant theme rules — instruct "reuse existing classes and CSS
  variables; never redefine or edit theme rules".
- Config: `{ "model": "openai/gpt-5.1" }`.
- Condensed in-repo fallback (`CODEGEN_FALLBACK_PROMPT`), like the copilot one.

Dynamic sections composed in `lib/ai/codegen.ts` per request: action preamble
(create/add/edit), `CURRENT_CODE` (fenced html + css from the POST body),
edit-mode ID semantics + selected-IDs line, allowed media queries derived
from `devices` (exact widths only), target/position line for add mode.

## Server: `app/api/generate/route.ts`

- Validates body (action, plan, pageHtml/pageCss, targetIds, devices).
- Fetches `page-builder-codegen` from Langfuse (300 s cache + fallback),
  builds systemPrompts (static tier cached-first, `CURRENT_CODE` second —
  gpt-5.x has implicit prefix caching, and explicit `cache_control` is
  harmless), calls `openRouterText(model-from-config)`.
- v1 returns the completed `<generated_code>` payload as JSON (no SSE);
  parses/strips the sentinel server-side and rejects malformed output once
  (single retry with a corrective message) before returning an error.
- Langfuse: same `sessionId` (threadId passed in body) so orchestrator and
  code-gen generations appear in one session; tags
  `["page-builder","codegen"]`, promptName/version attrs; `after()` flush.

## Client: apply utility (`components/page-builder/apply-generated.ts` or `lib/editor/`)

- Input: generated HTML string + action + target info.
- DOMParser split: `<style>` content vs elements.
- **add**: insert elements at `position` relative to target component
  (`component.append` / collection `at` index); **edit**: for each top-level
  element whose `id` matches an existing component, replace that component
  (children-passed-are-kept semantics — literally replace with the new
  subtree); **create**: set wrapper components.
- CSS: `editor.addStyle()` for the new rules (flat classes make this safe for
  the Style Manager).
- Wrap the whole application in a single undo step (GrapesJS UndoManager) so
  one Ctrl+Z reverts an AI change; select the (first) new/edited component
  after apply so the user sees what changed.
- Guardrails: known GrapesJS 0.22 hazard — a bare textnode as the only child
  of a non-text element crashes the drag sorter (memory
  `feedback_grapesjs_textnode_leaf_sorter_crash`). Verification must include
  dragging AI-generated elements; if it bites, post-process text leaves.

## Route/chat wiring

- `app/api/chat/route.ts`: adapter → `openRouterText("openai/gpt-5-mini")`
  (model from prompt config w/ fallback); merge client-declared tools from
  `chatParamsFromRequest` into `chat()` (TanStack `mergeAgentTools` path);
  optional OpenRouter reasoning options mirroring Studio's example
  (`reasoningEffort: low`) if the adapter exposes them — check at impl time.
- `components/ai/chat.tsx`: instantiate `.client(execute)` tools with access
  to the editor instance; `editComponent`/`removeComponent` get
  `needsApproval: true` (UI already renders approve/deny).
- minimax-m3 is fully retired from the product path.

## Cost sanity (per interaction, rough)

- Orchestrator turn: ~7k in / ~0.5k out on gpt-5-mini ≈ **$0.003** (implicit
  prefix caching should cut the repeated tier-0/1 further).
- Code-gen invocation: ~8k in / ~2k out on gpt-5.1 ≈ **$0.03**.
- Usage accounting: chat usage UI unchanged; code-gen usage lands in Langfuse
  per generation. Surfacing codegen cost on the tool marker + ledger billing
  integration stay out of scope (see ai-usage-billing-gap doc).

## Implementation order (each step independently verifiable)

1. **`lib/ai/codegen.ts` + `/api/generate`** — author `page-builder-codegen`
   v1 in Langfuse (maintainer pastes, like v2); testable standalone with curl
   against a captured editor context. STOP for prompt-text review.
2. **Client apply utility** — testable with a canned generated payload
   against the About page (add/edit/undo paths).
3. **Tools** — `lib/ai/tools.ts` definitions, client instances in `chat.tsx`,
   server merge in `route.ts`; approval flow on `editComponent`/
   `removeComponent`.
4. **Orchestrator v3 + model swap** — v3 text review → paste → label move;
   adapter switch to gpt-5-mini. STOP for prompt-text review.
5. **End-to-end verification** (below), then commit.

## Verification

- **add**: "add a testimonials section" on the About page → narration → tool
  marker → section appears below Experiences with `data-gjs-name`, flat
  classes, only whitelisted media queries; one Ctrl+Z removes it; drag the
  new section (textnode-sorter hazard).
- **edit**: select the CTA title → "make it italic with an accent line" →
  approval prompt → only that element changes; siblings untouched.
- **remove**: deny → nothing happens; approve → component gone, undoable.
- **empty canvas**: on the empty Homepage, "build me a landing page for …" →
  `generatePage` → full page reusing theme CSS variables/classes.
- **advice-only**: "what would you improve?" → no tool call, chat answer
  (regression on 016 scenarios a–c).
- **traces**: one session shows gpt-5-mini iteration generations + gpt-5.1
  codegen generations with their prompt names/versions; check
  `input_cached_tokens` on turn 2+ (OpenAI implicit caching — expect real
  numbers this time, unlike minimax).
- `pnpm typecheck && pnpm lint`.
