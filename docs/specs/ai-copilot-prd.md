# AI Copilot — Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | AI Copilot for the Site Builder |
| **Status** | Draft v1.0 |
| **Owner** | _TBD_ |
| **Last updated** | 2026-06-30 |
| **Related docs** | `ai-copilot-tdd.md`, `ledger-service-prd.md` (credit consumption contract) |

---

## 1. Summary

The AI Copilot is an in-editor assistant for tour operators using the GrapesJS-based site builder. It lets a non-technical operator edit their site in plain English, proactively surfaces improvements (SEO, accessibility, responsive design, performance), and self-heals when a generated change fails. It is delivered as an embeddable panel that operators can place anywhere in their UI and configure with their own AI provider.

## 2. Problem statement

Tour operators are domain experts, not web developers. Today, even small site changes ("make the header red", "improve mobile layout") require knowledge of the editor's component model, CSS, and best practices. As a result:

- Operators ship sites with avoidable SEO, accessibility, and performance gaps.
- Editing is slow and intimidating, increasing churn and support load.
- There is no in-product guidance that understands the *current* state of the page.

## 3. Goals & non-goals

### Goals
- Let operators make changes through natural language, applied live on the canvas.
- Proactively suggest high-value improvements without being asked, across four domains.
- Make every AI action transparent (plain-English explanation + inspectable code).
- Recover gracefully from failed changes ("Didn't work" → different approach).
- Keep AI/token cost controlled and predictable.
- Be embeddable and configurable (provider, model, prompt, container, sensitivity).

### Non-goals
- Not a general-purpose chatbot or content writer beyond page edits/suggestions.
- Does not replace manual editing — it augments the GrapesJS editor.
- Does not own billing/credit accounting (that is the Ledger Service; see §11).
- Does not manage AI provider accounts or API key procurement for operators.

## 4. Users & personas

- **Primary — Tour Operator (Editor):** non-technical; wants a polished, correct site with minimal effort.
- **Secondary — Platform Operator / Integrator:** embeds and configures the Copilot (provider, model, prompt template, sensitivity, container).

## 5. User stories

> As a tour operator, I want an AI assistant that uses an LLM to generate responsive sections, watch my edits, understand my intent, and suggest smart actions — from fixing SEO to making the site more accessible.

Supporting stories:
- As an operator, I type plain English and the change is applied directly to my page.
- As an operator, I get proactive suggestions after meaningful edits, grouped by domain.
- As an operator, I can see exactly what will change and why, and inspect the raw code.
- As an operator, when a change fails I can say "Didn't work" and get a different fix.
- As an integrator, I can plug in my own provider/model/prompt and embed the panel.

## 6. Functional requirements

Requirements use **MUST / SHOULD / MAY** (RFC-2119). IDs are stable for traceability.

### 6.1 Natural-language editing
- **FR-NLE-1 (MUST)** Accept plain-English instructions and apply the change to the page.
- **FR-NLE-2 (MUST)** Submit via Enter (without Shift) or button; block empty input.
- **FR-NLE-3 (MUST)** Recall/reuse previous prompts via Arrow Up/Down (history capped at 50; no consecutive duplicates).
- **FR-NLE-4 (MUST)** Allow stopping a running request at any time without losing page state.

### 6.2 Proactive suggestions
- **FR-PS-1 (MUST)** Watch the page and auto-suggest improvements after *meaningful* edits, unprompted.
- **FR-PS-2 (MUST)** Categorize suggestions into **SEO, Accessibility, Responsive Design, Performance**.
- **FR-PS-3 (MUST)** Provide a manual **Suggest** trigger that bypasses all logic gates.
- **FR-PS-4 (MUST)** Never fire redundant suggestions for trivial/cosmetic-only changes (see §6.7 gates).

### 6.3 Apply model
- **FR-AP-1 (MUST)** Auto-suggestions require explicit **Apply** before execution.
- **FR-AP-2 (MUST)** User-prompted changes execute immediately (no confirmation).
- **FR-AP-3 (MUST)** Applied changes reflect live on the canvas.

### 6.4 Self-healing on failure
- **FR-SH-1 (MUST)** Show a "Didn't work" button in the suggestion state at all times.
- **FR-SH-2 (MUST)** On click, send failure context (error logs + previous code) back to the AI and request a *fundamentally different* approach.
- **FR-SH-3 (MUST)** Never repeat a failed strategy on retry.

### 6.5 Transparency
- **FR-TR-1 (MUST)** Every suggestion shows a plain-English explanation of what changes and why.
- **FR-TR-2 (MUST)** Operator can inspect the raw generated JS before/after applying (Show/Hide code).
- **FR-TR-3 (MUST)** Success/failure indicated with clear visual status icons (auto-hide after 3s).

### 6.6 Usage metrics
- **FR-UM-1 (MUST)** Display API tokens consumed per suggestion.
- **FR-UM-2 (SHOULD)** Show retry count when retries occurred.
- **FR-UM-3 (SHOULD)** Show error count with a tooltip describing what went wrong.

### 6.7 Responsible API usage (logic gates)
- **FR-RU-1 (MUST)** Only run background analysis when the operator has made a meaningful number of edits.
- **FR-RU-2 (MUST)** Skip analysis when content has not *structurally* changed.
- **FR-RU-3 (MUST)** Block concurrent analysis; user prompts always take priority over background analysis.
- **FR-RU-4 (MUST)** Minimize token cost (truncate large assets, limit history sent).

> The precise gate thresholds (temporal, change-threshold, structural hash, diff %, concurrency) are specified in the TDD §5.

### 6.8 Context awareness
- **FR-CX-1 (MUST)** Always know current page HTML, CSS, and project structure.
- **FR-CX-2 (MUST)** Know the currently selected component.
- **FR-CX-3 (MUST)** Know active device (Desktop/Tablet/Mobile) and which panels are open.
- **FR-CX-4 (MUST)** Receive recent action history to infer intent.

### 6.9 Customizable behavior
- **FR-CB-1 (MUST)** Operators can choose provider (Claude/Anthropic or OpenAI) and model.
- **FR-CB-2 (MUST)** Operators can supply a custom prompt template or load one from a URL.
- **FR-CB-3 (MUST)** Operators can tune check frequency and sensitivity.
- **FR-CB-4 (MUST)** Operators can embed the panel into any part of their own UI.

### 6.10 Resilient API handling
- **FR-RA-1 (MUST)** Retry failed API calls up to 4 times (5 total) with exponential backoff.
- **FR-RA-2 (MUST)** Each retry gives the AI additional error context to self-correct.
- **FR-RA-3 (MUST)** Requests are cancellable mid-flight or mid-retry without side effects.

## 7. Non-functional requirements

- **Performance:** Background analysis must not block editing; user prompts preempt background work.
- **Cost control:** Token usage tracked per request; payloads truncated; history limited.
- **Reliability:** Network/parse failures degrade gracefully (safe fallbacks, never crash the editor).
- **Security/Privacy:** API keys handled per integrator config; page content sent to the configured provider only. Generated JS is executed in the editor context — see TDD §8 (code-execution risk).
- **Extensibility:** Provider-agnostic; prompt-template-driven behavior.
- **Accessibility:** The panel UI itself must meet the accessibility bar the product promotes.

## 8. Success metrics

- % of edits made via Copilot vs manual.
- Suggestion **acceptance rate** (Apply clicks ÷ suggestions shown).
- Self-heal **recovery rate** ("Didn't work" → eventually-successful change).
- Average tokens per successful change (cost efficiency).
- Reduction in sites shipping with SEO/accessibility defects.

## 9. Out of scope (v1)

- Multi-step autonomous workflows without operator confirmation.
- Cross-page bulk edits in a single instruction.
- Provider billing/credit purchase flows (Ledger + Billing own this).

## 10. Dependencies

- GrapesJS editor and its component/style/device APIs.
- An AI provider SDK (Anthropic / OpenAI) reachable via a fetch wrapper.
- LangFuse for token-usage observability.
- AI Usage Service + Ledger Service for credit accounting (see §11).

## 11. Integration contract — credit consumption

The Copilot itself does **not** account for credits. The seam is:

```
AI Copilot request → tokens consumed (observed via LangFuse)
        → AI Usage Service: calculate credits, create usage record
        → Ledger Service: post AI_USAGE transaction (idempotent)
```

The Copilot's responsibility ends at producing accurate token usage per request and a stable request identifier the AI Usage Service can use as an idempotency key. See `ledger-service-prd.md`.

## 12. Risks & open questions

- **Risk:** Executing AI-generated JS in the editor can break a page or run unintended code. *Mitigation:* sandboxed execution, explicit Apply for background suggestions, code preview, self-heal. (See TDD §8.)
- **Risk:** Token cost spikes from chatty operators or large pages. *Mitigation:* logic gates + truncation + history limits.
- **Open:** Should generated JS be validated/linted before execution?
- **Open:** Per-operator rate limits independent of credit balance?
- **Open:** How are prompt-template changes versioned and rolled out?

## 13. Milestones (suggested)

1. **M1 — Core editing loop:** NL prompt → generate → execute → status.
2. **M2 — Proactive suggestions + logic gates:** background analysis, four domains, Apply flow.
3. **M3 — Resilience & transparency:** retry/backoff, self-heal, code preview, metrics.
4. **M4 — Configurability & embedding:** provider/model/prompt/container options.
5. **M5 — Observability & credit integration:** LangFuse + AI Usage Service hook.
