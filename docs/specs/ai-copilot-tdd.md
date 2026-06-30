# AI Copilot — Technical Design Document (TDD)

| | |
|---|---|
| **Component** | AI Copilot (embeddable editor assistant) |
| **Status** | Draft v1.0 |
| **Owner** | _TBD_ |
| **Last updated** | 2026-06-30 |
| **Related docs** | `ai-copilot-prd.md` (requirements, FR-IDs), `ledger-service-tdd.md` |

---

## 1. Overview

The Copilot is a client-side module that mounts into a GrapesJS editor. It gathers editor context, builds a prompt, calls a configurable AI provider, parses a strict JSON response (`{ explanation, code }`), and either auto-executes the code (user prompts) or offers it for Apply (background suggestions). It tracks edits to decide *when* to run background analysis, and self-corrects on failure.

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ AI Copilot                                                     │
│                                                                │
│  Config/Init ──► Prompt Manager ──► Context Gatherer           │
│       │                 │                  │                   │
│       ▼                 ▼                  ▼                    │
│  UI Component ◄── Suggestion Engine ──► AI Provider + Retry     │
│       ▲                 │                  │                   │
│       │                 ▼                  ▼                    │
│  Action Tracker   Logic Gates       Response Parser            │
│  Console Interceptor                Token Manager (LangFuse)   │
└──────────────────────────────────────────────────────────────┘
                         │
                         ▼  (executes generated JS)
                    GrapesJS Editor
```

### Modules
| Module | Responsibility | PRD ref |
|---|---|---|
| Config/Init | Validate options, wire up listeners, intervals, console interception | FR-CB-* |
| UI Component | Render the 4 states; capture prompts; dispatch events | FR-NLE, FR-TR, FR-UM |
| Suggestion Engine | Orchestrate analyze → call → parse → apply | FR-PS, FR-AP |
| Logic Gates | Decide whether background analysis runs | FR-RU |
| Context Gatherer | Build editor/project/UI/state context | FR-CX |
| Prompt Manager | Resolve/cache template, inject variables | FR-CB-2 |
| AI Provider + Retry | Call provider via abortable fetch; backoff retries | FR-RA |
| Response Parser | Strip fences, validate, fallback | — |
| Action Tracker | Record component add/remove/style/select/update | FR-CX-4 |
| Console Interceptor | Capture logs/errors for failure context | FR-SH-2 |
| Token Manager | Aggregate token usage, expose metrics | FR-UM |

## 3. Configuration & initialization

Options accepted at init:

| Option | Type | Default | Notes |
|---|---|---|---|
| `aiProvider` | `'claude' \| 'anthropic' \| 'openai'` | — | Throw on unrecognized provider |
| `apiKey` | string | env `OPENAI_API_KEY` fallback | |
| `model` | string | provider default if null | |
| `maxTokens` | number | `2000` | |
| `updateInterval` | ms | `2000` | background analysis tick |
| `minChangesThreshold` | number | `5` | change-threshold gate |
| `customPrompt` | string | — | overrides default template |
| `promptUrl` | URL | — | remote template source |
| `containerElement` | HTMLElement | — | inject UI here |
| `containerSelector` | CSS selector | — | alternative to `containerElement` |

If no container is provided, fall back to a GrapesJS panel (350×400px, fixed, top-right). On init, set up: suggestion component, event listeners, action tracking, console interception, and the periodic analysis interval.

> **Note on naming:** PRD lists provider values `'claude' | 'anthropic' | 'openai'`. The source doc also shows a typo'd `'anthorpic'`/`OPEN_API_KEY`; the canonical spellings above are authoritative.

## 4. UI component & render states

Implemented with Shadcn UI. Exactly one of four states renders:

1. **Loading** — spinner + clickable **Stop** button.
2. **Error** — "Connection Error" box + message + prompt input + Ask AI/Suggest.
3. **Welcome** — prompt input + Ask AI/Suggest only.
4. **Suggestion** — metrics, explanation, action buttons, Show/Hide code toggle, status message, second prompt input.

Rules: auto-suggestions show **Apply**; user-prompt results do not (auto-executed). Status messages auto-hide after 3s. "Ask AI" disabled when input empty or a request is in progress.

### Event interface (custom DOM events)
| Event | Detail | Trigger |
|---|---|---|
| `user-prompt` | `{ prompt }` | prompt submitted (input cleared) |
| `refresh-request` | — | **Suggest** clicked (bypasses gates) |
| `stop-request` | — | **Stop** clicked (abort) |
| `didnt-work` | `{ suggestion, explanation, code }` | "Didn't work" clicked |
| `apply-success` | `{ suggestion, result, isUserPromptResult }` | execution succeeded |
| `apply-error` | `{ suggestion, error, isUserPromptResult }` | execution failed |

## 5. Logic gates (background-analysis admission control)

Background analysis (the periodic tick) must pass **all** gates. The manual **Suggest** button (`forceAnalysis()`) bypasses them.

1. **Temporal gate** — `shouldRunAnalysis()` runs on `setInterval(updateInterval)`. If `changeCount > 0` but analysis is skipped, log the reason.
2. **Change-threshold gate** — block if `changeCount < minChangesThreshold`. Reset `changeCount = 0` and update `lastSnapshot` after every successful analysis *and* after any user-prompt execution (success or error). `forceAnalysis()` sets `changeCount = minChangesThreshold` to bypass.
3. **Structural-hash gate** — build a snapshot { normalized HTML, normalized CSS, component count, structural hash }. Normalization collapses whitespace, normalizes `{}`/`:` spacing, trims, lowercases. Hash is a 32-bit djb2-style hash of `normalizedHTML + normalizedCSS`. If hash unchanged → skip entirely.
4. **Diff-threshold gate** — if hash changed, compute char-level diff ratio for HTML and CSS separately. Proceed only if HTML diff **or** CSS diff > **3%**, **or** component count changed by any amount. First analysis (null/empty `lastSnapshot`) always runs.
5. **Concurrency gate** — `isAnalyzing` flag prevents a second background analysis while one runs. Set `true` at the start of `handleUserPrompt()`, cleared in a `finally`. User prompts take priority.

## 6. Context gathering

Context object includes:
- Full project HTML + CSS from the editor.
- Full project data (pages, styles…) with base64 asset `src` truncated to **30 chars**.
- Selected component ID, or `"No component currently selected"`.
- UI state string: current device, all devices (serialized), visible panels, current page name, CSS selector, modal open state, active commands, and per-panel states (blocks, layers, style manager, asset manager).
- If any UI-state retrieval fails → safe fallback object (all fields null/false/empty).
- `states` array = last 3 response-history entries incl. `actionCompleted`, `wasSuccessful`, `wasUserInitiated`.
- For user-initiated requests, `context.userPrompt` is set before building the prompt.

## 7. Prompt management

- **Priority:** `customPrompt` > `promptUrl` > built-in default.
- Loaded prompt cached in `loadedPrompt`; subsequent calls reuse cache. `reloadPrompt()` clears cache and refetches.
- On `promptUrl` fetch failure (non-OK or network error) → warn + fall back to default.
- Template vars replaced via `{{variableName}}` global regex. Supported: `{{projectData}}`, `{{selectedComponent}}`, `{{uiState}}`, `{{userPrompt}}`, `{{states}}`. Legacy `{{html}}`, `{{css}}`, `{{previousResponses}}` still supported.
- Missing user prompt → `{{userPrompt}}` becomes `'No specific user request - suggest general improvements'`.
- `{{states}}` built from last 3 history entries; each = timestamp, user request (if any), HTML snippet, CSS snippet, AI response summary, console logs. HTML/CSS snippets truncated to **200** chars, code snippets to **100**, console logs capped at **100/state**.
- `safeStringify()` handles circular refs (`[Circular Reference]`), functions (`[Function]`), DOM elements (`[DOM Element]`).
- Default prompt: return **only valid JSON** with `explanation` + `code` (no markdown); mandate comprehensive `console.log` before/during/after each op; instruct a *fundamentally different* approach on reported failure; **forbid native DOM APIs** (GrapesJS component methods only); mandate `editor.Devices.select()` before every style op; include a full GrapesJS API quick reference; inject the variable sections at the end.

## 8. Code execution & security

User-prompt results auto-execute via `new Function('editor', code)(editor)`. Background suggestions execute only on **Apply**.

- On success: prefix the explanation, append the result, dispatch `apply-success`.
- On failure: prefix the explanation, **preserve the original plan**, dispatch `apply-error`.
- **Risk:** arbitrary JS execution in the editor context. *Controls:* explicit Apply for background suggestions; mandatory code preview; provider-side prompt constraints (GrapesJS-only, no native DOM); self-heal. *Open:* pre-execution static validation/lint of generated JS.

## 9. Error recovery ("Didn't Work" flow)

- Button always visible in suggestion state.
- On click → dispatch `didnt-work` `{ suggestion, explanation, code }`.
- Gather console logs from the **last 15s**, filtered to `error` level or messages containing `✅`/`❌`, capped at **10** entries, each truncated to **100** chars.
- Add failure context (previous code, explanation, console logs) to the prompt so the AI self-corrects with a different approach (FR-SH-3: never repeat the failed strategy).

## 10. AI provider & retry system

- Each request creates a fresh `AbortController`; the signal threads through a custom fetch wrapper into the provider SDK.
- `abortCurrentRequest()` aborts in-flight requests **and** pending retry delays.
- Abort signal checked before each attempt and before each retry delay; cancellation throws `'Request was cancelled by user'`.
- Retry delay listens to the abort signal and rejects immediately on abort.
- Retry up to **4** times (5 total) with exponential backoff: `min(1000 × 2^attempt, 10000)` ms.
- On `attempt > 0`, prepend error context to `context.states` for self-correction.
- After all attempts: throw `'AI request failed after N attempts. Last error: <message>'`.
- `hasActiveRequest()` → true while an `AbortController` is active.

## 11. AI response parsing

- Strip leading fence (` ```json `, ` ```javascript `, or ` ``` `) and trailing/inline fences.
- Validate parsed JSON has **both** `explanation` and `code`; throw if either missing.
- On any parse failure → safe fallback `{ explanation: "Sorry…", code: "console.log('AI response parsing failed');" }`.

## 12. Action tracking

Tracks (each with timestamp; capped at **50** entries, oldest removed):
- `component:add` — type, tagName, id, classes, parent.
- **Duplication detection** — same type+tagName added within **10s** → recorded as `component_duplicate` with `originalID`.
- `component:remove` — type, id.
- `styleable:change` — type, id, property, value, previousValue.
- `component:selected` — type, id.
- `component:update` — type, id.
- All calls null/type-guarded; invalid components skipped with `console.warn`.

## 13. Console interception

- Override `console.log/warn/error/info` on init; preserve and still call originals.
- Capture { timestamp, level, message (objects JSON-stringified), source: 'component' }.
- `errorLog` capped at **20** entries (oldest removed).
- `getConsoleLogs(sinceTimestamp)` returns logs at/after the given timestamp.

## 14. Token management & observability

- Use **LangFuse** to obtain token usage. Fallback estimate: `ceil(text.length / 4)`.
- `totalTokensUsed` accumulates across successful attempts in a session.
- `resetTechnicalDetails()` zeros `totalRequests`, `totalRetries`, `totalTokensUsed`, `errors` before each new request session.
- `getTechnicalDetails()` returns a copy with `errors` capped at last **10**.
- Technical details pushed to UI after every request. Token badge always; retry badge only when `totalRetries > 0`; error badge only when errors exist (hover → first error).
- **Token savings:** base64 asset `src` truncated to **20** chars; response history sent limited to last **3**; console logs sent capped at **10** and truncated to **100** chars.

## 15. State & history management

- Every AI response (user + background) stored in `responseHistory` with id, timestamp, context, suggestion, explanation, code, userPrompt (if any), `feedback: null`. Capped at **10** (newest first).
- `analysisHistory` stores all responses uncapped (external access via `getAnalysisHistory()`).
- `getActions()` exposes the full `userActions` array.

## 16. Suggestion domains (AI output)

- **SEO:** meta description, alt text, heading structure, canonical URLs.
- **Accessibility:** ARIA labels, color contrast, keyboard nav, screen-reader compatibility.
- **Responsive:** viewport meta, media queries, flexible layouts, image responsiveness.
- **Performance:** image optimization, lazy loading, CSS minification, unused-code detection.

## 17. Credit-accounting integration

The Copilot reports token usage per request; the **AI Usage Service** converts tokens → credits and posts an idempotent `AI_USAGE` transaction to the **Ledger Service**. The Copilot supplies a stable request identifier usable as the ledger idempotency key. The Copilot never writes ledger entries directly. See `ledger-service-tdd.md`.

## 18. Testing strategy

- **Unit:** logic gates (each gate in isolation), prompt variable injection, response parser (fence stripping + fallback), retry/backoff math, token estimation, action-tracker caps/guards.
- **Integration:** end-to-end prompt → execute against a mock editor; abort mid-flight and mid-retry; promptUrl fetch failure → fallback; "Didn't work" context assembly.
- **Behavioral:** concurrency gate (user prompt preempts background); structural-hash skip; diff-threshold edge cases (3% boundary, component-count change).

## 19. Risks, tradeoffs, open questions

- **Arbitrary JS execution** is the central risk — see §8.
- **Tradeoff:** auto-executing user prompts (no confirm) trades safety for speed; mitigated by self-heal + preview.
- **Open:** static validation of generated JS before execution; per-operator rate limiting; prompt-template versioning/rollout.
