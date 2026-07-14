# Interactive Components — Web-Component Blocks + AI Manifest

**Status:** Design / proposal. Not built.
**Scope:** Accordions, tabs, dialogs (and future interactive primitives) authored in
the GrapesJS builder **and** emitted/edited by the AI assistant.

---

## 1. Goal

Ship a family of interactive blocks (accordion, tabs, dialog) that:

1. Are **draggable and editable** in the GrapesJS canvas like any other block.
2. Are **fully styleable** by the Style Manager and this repo's theme / published-CSS
   pipeline (no encapsulation blind spots).
3. Can be **written and edited by the AI assistant** (copilot + `/api/generate` codegen)
   reliably — the model emits a small declarative tag, not fragile hand-wired markup.
4. Feed the AI their contract from a **single source of truth** so the description the
   model sees can never drift from what the blocks actually are.

The last two points are the reason this design exists. Interactive widgets in the
GrapesJS ecosystem (e.g. `grapesjs-tabs`) export nested `<div>` soup with matching
`aria-controls`↔`id` pairs, `hidden` attributes, and a per-instance `<script>` block.
That is exactly the kind of markup an LLM gets wrong — cross-referenced ids and ARIA
wiring are among the most common codegen failure modes.

---

## 2. Decision

**Author each interactive primitive as a light-DOM Custom Element that supplies runtime
behavior, wrap it with a GrapesJS custom type for authoring, and describe it once in a
manifest that feeds both the editor and the AI.**

Three cooperating artifacts per component, one canonical description:

```
component manifest  (tag, attributes, allowed children, description, example)
      │
      ├──► GrapesJS blocks + custom types      (authoring: drag, drop, traits, layers)
      ├──► <tc-*> light-DOM custom element      (runtime: behavior, a11y, self-heal)
      └──► AI assistant context                 (codegen prompt / tool schema + examples)
```

### 2.1 Why a Custom Element (and not just a GrapesJS `script`)

| Benefit | Why it matters here |
| --- | --- |
| **One declarative tag** the AI emits (`<tc-tabs>` + `<tc-tab label="…">`) instead of div soup + id wiring | Removes the id cross-referencing failure mode; far fewer tokens in the codegen output |
| **Self-heal in `connectedCallback`** (generate missing ids, wire ARIA, default active tab) | Sloppy AI output still renders correctly instead of breaking silently |
| **Automatic lifecycle** (`connected/disconnected/attributeChanged`) | Survives dynamic content, client-side nav, re-renders — a GrapesJS `script` runs once at render and never re-fires |
| **Portable, testable class** | Same element runs in the canvas, the published Next.js page, and unit tests; no stringified functions |
| **Clean round-trip** | When the copilot reads the page back (its `pageHtml` context), `<tc-tabs>` is self-evidently a tabs widget; div soup + a per-id script is not |
| **Manifest is machine-readable** | The "send context to the AI" tool falls out of the standard custom-elements manifest as a byproduct |

### 2.2 Why **light DOM, no shadow DOM**

Shadow DOM would seal the component internals off from the Style Manager, the
protected-rule filter, style extraction, and the published CSS-artifact pipeline
(`docs/public-render-design.md`, plan 023). Those are exactly the systems this project
built for styling. So:

- **No shadow root.** `<tc-tabs>` holds ordinary light-DOM children.
- **No `<slot>`.** Slots only work inside shadow DOM; without a shadow root they do
  nothing. Children are plain descendants.
- The custom tag defaults to `display: inline` (unknown element) — the GrapesJS type
  must set `display: block` (or appropriate) in its `defaults.styles`.

Net effect: to CSS, GrapesJS, and the theme pipeline, `<tc-tabs>` is indistinguishable
from a `<div>` — fully styleable — while the class adds behavior on top.

### 2.3 What stays in the GrapesJS layer

The custom element does **not** replace the GrapesJS type. Authoring/structure logic
lives in the model layer either way:

- `isComponent` binding for `<tc-tabs>` / `<tc-tab>` / etc.
- `droppable` / `draggable` / `removable` / `copyable` rules.
- Traits (e.g. "Add Tab" button trait, per-item labels).
- Layer names, add/remove/clone wiring (the tab↔panel model linking `grapesjs-tabs`
  does in `__initTab` / `__onRemove` / `clone`).

So the work is **split**, not reduced: `<tc-*>` = runtime, GrapesJS type = authoring.

### 2.4 Why the GrapesJS type decomposition is still required

A composite widget is **not** modeled as one GrapesJS type — `grapesjs-tabs` /
`GrapesJS/components-tabs` split it into five (`tabs`, `tab-container`, `tab`,
`tab-contents`, `tab-content`). That split is **not** "so each part is editable"; it
exists because GrapesJS attaches `draggable` / `droppable` / `removable` / `copyable` /
`highlightable` / `locked` rules **per component type**. A single monolithic type cannot
express "reorder tabs within the tablist, but never drag panels, never delete the
scaffolding, yet freely edit tab labels and panel contents." You decompose to hang
different rules on each part — and for most parts the rule is *lock it down*, not expose
it:

| Part | Intent |
| --- | --- |
| tablist container, panels wrapper | **locked scaffolding** — `removable/draggable/droppable: false` so the widget can't be broken |
| individual panel / tab shell | shell locked (no move/delete/duplicate); **contents editable** |
| tab label, panel body | **exposed** for editing + styling |

The mental model is **controlled editing**: expose the two things authors should touch
(labels, panel contents) and lock everything whose drag/delete would break the widget.

Critically, **this decomposition survives the move to web components.** The `<tc-*>`
element only absorbs the *runtime behavior* (out of the `tabs` `script`); the per-part
edit/lock rules, traits, and add/remove/clone wiring are pure GrapesJS-authoring
concerns and must still be modeled as separate types (`tc-tabs`, `tc-tab`, …). Web
component ≠ fewer GrapesJS types.

---

## 3. Editor vs. runtime behavior

A self-switching element fights the editor's click-to-select just like native
`<details>`/`<dialog>`. Two mechanisms keep editing sane:

1. **`editing` attribute.** The GrapesJS type sets `editing` on the element inside the
   canvas. The element observes it and (a) disables switching/closing and (b) reveals
   all panels/items so every part is selectable and styleable. Exported markup has no
   `editing` attribute, so the published page behaves normally.
   - This is the clean successor to `grapesjs-tabs`' `window._isEditor` flag and the
     `frameElement.classList.contains('gjs-frame')` guard — same idea, declarative.
2. **Editor-only CSS** (via `canvas:frame:load`) can additionally force any
   still-hidden state visible in the canvas as a safety net.

---

## 4. How the element JS runs across the three contexts

Underlying fact: **custom-element registration is per-document.** Every browsing
context — the editor's outer window, the canvas iframe, a preview page, the published
page — has its own `customElements` registry. `<tc-tabs>` only *upgrades* (runs its
class) in a document where `customElements.define('tc-tabs', …)` has executed.

| Context | Element defined by | `editing` attr? | Behavior runs? |
| --- | --- | --- | --- |
| **Canvas (edit)** | `canvas.scripts` (GrapesJS injects it into the iframe) | yes (DOM-only) | no — all panels shown |
| **Preview (`core:preview`)** | same iframe, already defined | removed on preview | yes |
| **Published page** | your own `<script>` (NOT the export) | no | yes |

The one-liner: **the same class runs everywhere; a single non-persisted `editing`
attribute is the only difference between "editable" and "live," and the element JS must
be shipped separately for the published page because GrapesJS won't export it.**

### 4.1 Canvas (editing)
- Load the definition via `grapesjs.init({ canvas: { scripts: ['/wc/tc-tabs.js'] } })`.
  On each render/re-render GrapesJS upgrades the element → `connectedCallback` → self-heal
  runs. Because it's lifecycle-driven, moving the element fires
  `disconnected`→`connected` and it re-initializes cleanly (a per-instance `<script>`
  does not re-run).
- The GrapesJS type sets `editing` so behavior is suppressed and all panels are shown.
  Set it as a **DOM-only** attribute so it never leaks into `getHtml()` / storage:

  ```js
  // in the type's view, on render — touches the live node, not the model
  onRender() { this.el.setAttribute("editing", "") }
  // NB: component.addAttributes({...}) WOULD persist/export it — don't use that here.
  ```

### 4.2 Preview (`core:preview`)
- `core:preview` does **not** swap the document or reload — it only hides GrapesJS chrome
  and disables editor interactions. Same iframe, same already-upgraded element.
- The only thing that makes preview behave like the real page is toggling off `editing`:

  ```js
  editor.on("run:core:preview", () => el.removeAttribute("editing"))
  editor.on("stop:core:preview", () => el.setAttribute("editing", ""))
  ```

  The class's `attributeChangedCallback` reacts (collapse panels, attach switching) and
  reverses on exit. Edit vs. preview is *purely that one attribute*.
- A separate preview **route** that renders stored HTML (e.g. `page-preview.tsx`) is a
  fresh document → behaves like the published page below, not like `core:preview`.

### 4.3 Published page (separate document)
- **`canvas.scripts` are editor-only** — never in `editor.getHtml()`. Ship the element JS
  to the published page yourself: a `<script src>` in the Next render, or the
  component-related self-injection pattern (element injects its own `<script>` if the
  class is undefined).
- Published HTML has **no `editing` attribute** → the element upgrades on load and runs
  full behavior. Clean export: `<tc-tabs><tc-tab label="…">…</tc-tab></tc-tabs>` — no id
  soup, no inline per-instance script.

---

## 5. Per-component notes

**Accessibility baseline:** every interactive component targets its **W3C ARIA APG
pattern** ([apg/patterns](https://www.w3.org/WAI/ARIA/apg/patterns/)) — tabs → Tabs,
accordion → Accordion, dialog → Modal Dialog. The APG pattern is the acceptance
criterion for the runtime element, not a nice-to-have. The colocated authoring contract
(`<tc-tab label>`) exists precisely so the element can *generate* fully-conformant ARIA
markup that authors and the AI could not reliably hand-write.

### 5.1 `<tc-accordion>` / `<tc-accordion-item>`
- Item carries `label` (attr) + body (children). Element wires `role`/`aria-expanded`,
  single- or multi-open via an `multiple` attr.
- `editing` → all items expanded.
- APG target: [Accordion](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/) — header
  `<button>` with `aria-expanded` + `aria-controls`; region `aria-labelledby` the header;
  Enter/Space toggle, optional Up/Down/Home/End between headers.

### 5.2 `<tc-tabs>` (ENHANCER model — SHIPPED 2026-07-13)

> **Superseded the colocated `<tc-tab label>` generator approach.** Hands-on authoring
> showed the runtime-generated tablist couldn't be edited inline and hid all panels at
> once. We pivoted to the **`knadh/oat` enhancer model**: the tablist, tabs, and panels
> are **real, directly-editable GrapesJS components**, and the web component *enhances*
> that markup at runtime (self-heals ids/ARIA, links tabs↔panels, switches, a11y) rather
> than generating it. Trade-off accepted: more verbose serialized markup + a less-minimal
> AI contract (the AI now emits the role-based structure, not `<tc-tab label>`).

**Authoring contract & component tree** (5 GrapesJS types, ported from `grapesjs-tabs`):
```
tc-tabs
├── tc-tab-list      (role="tablist")   — "Add Tab" trait
│   └── tc-tab*       (role="tab", <button> with an inner editable <span> label)
└── tc-tab-panels    (panels wrapper, locked)
    └── tc-tab-panel* (role="tabpanel", editable content)
```
- Tab↔panel linked by **id** (`tab.aria-controls === panel.id`), maintained model-side
  (`__initTab`/`__onRemove`/`clone`) — id-linking makes tab reordering robust for free.
- The **label must be an inner `<span>` text component** (not `editable:true` on the
  `<button>`) — a custom type does not get GrapesJS's RTE text view, but a real `text`
  child does (verified: dblclick activates inline editing).
- **Canvas = one panel at a time + click-to-switch** (like the live widget); `editing`
  keeps click-switch but disables roving-tabindex/arrow-key nav so it doesn't fight the
  editor. The web component creates **no** elements, so it no longer risks the React
  canvas renderer's child reconciliation.

**Web component (enhancer):** reads `[role=tablist]`/`[role=tab]`/`[role=tabpanel]`,
self-heals ids/ARIA by index when absent (honors an existing `aria-controls` link
otherwise), then the same APG behavior below.

- **APG target: [Tabs — Automatic Activation](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-automatic/).**
  The element maintains exactly this over the authored structure:

  **Roles & ARIA**
  - Tablist: `role="tablist"`, `aria-labelledby` (name the tab set); add
    `aria-orientation="vertical"` only for a vertical layout.
  - Each tab: `role="tab"`, `id`, `aria-controls`→its panel id, `aria-selected="true"`
    on the active tab / `"false"` on the rest.
  - Each panel: `role="tabpanel"`, `id`, `aria-labelledby`→its tab id, **`tabindex="0"`**
    (so the panel content is reachable by keyboard). Non-active panels `hidden`.

  **Roving tabindex** — active tab `tabindex="0"`, all others `tabindex="-1"`.

  **Keyboard (automatic activation = activate on focus, no Enter/Space needed)**
  - `Tab` → focus the active tab; a second `Tab` moves into the panel (panel is
    `tabindex="0"`).
  - `Left`/`Right` → move focus to prev/next tab **with wraparound**, and activate it
    immediately (automatic).
  - `Home`/`End` → focus + activate first/last tab.

  **Editing-mode interplay:** with `editing` set, keep **one panel visible + click-to-
  switch** (so the author navigates to each panel to edit it) but suppress roving
  `tabindex` and the arrow-key handler so editor focus/label-typing isn't hijacked. In
  live mode, full roving-tabindex + keyboard.
  - Automatic (vs. manual) activation is appropriate here because panels hold static
    content shown instantly; if a future panel needed expensive/async loading, switch
    that instance to manual activation per the APG guidance.

### 5.3 `<tc-dialog>`
- Trigger contract: `<tc-dialog>` with a `[data-tc-dialog-open]` trigger inside, or a
  sibling referencing it. Element handles open/close + focus trap + backdrop at runtime.
- `editing` / `open` attr → rendered inline (not top-layer, backdrop suppressed) so the
  dialog body is editable. Far easier for the AI to emit correctly than raw `<dialog>` +
  `showModal()` + matching-id trigger buttons.

---

## 6. Integration with the existing pipeline

### 6.1 Manifest (single source of truth)
Follow the established pattern in `lib/plugins/patterns/manifest.ts`: a **pure-data**
module (no `grapesjs`/editor imports) so server components and the codegen builder can
import it. Extend `BlockDescriptor` with the AI-facing contract:

```ts
export type InteractiveDescriptor = BlockDescriptor & {
  tag: string                 // "tc-tabs"
  attributes: { name: string; type: string; description: string }[]
  allowedChildren: string[]   // ["tc-tab"]
  description: string         // one line for the model
  example: string             // canonical minimal markup
}
```

Consumers:
- **Editor:** each `register*Block` reads `label`/`category` (as today) and registers the
  `<tc-*>` custom types.
- **Admin library:** `BUILTIN_PATTERNS` gains the interactive descriptors.
- **AI context:** a new builder serializes the descriptors into the codegen prompt.

### 6.2 AI codegen (`lib/ai/codegen.ts`)
- `CODEGEN_FALLBACK_PROMPT` currently forbids `<script>` and describes only raw
  HTML/CSS. Add an **"Interactive components"** section generated from the manifest:
  the tag, its attributes, allowed children, and the canonical `example`. Keep it in
  sync with the Langfuse `page-builder-codegen` prompt (same dual-source rule already
  noted in that file).
- The flat-selector / single-`<style>` / `data-gjs-name` rules still apply to the
  markup the model puts *inside* the components.

### 6.3 Applying AI output (`lib/page-builder/apply-generated.ts`)
- `parsePayload` already splits `<style>` + top-level elements via `DOMParser`. Custom
  tags parse fine; the GrapesJS types' `isComponent` binds them on load so they become
  editable components, not opaque blobs.
- **Requirement:** the `<tc-*>` element definitions must be registered in the **canvas
  iframe** (via `canvas.scripts` or a component-related dynamic inject) so they upgrade
  in-editor, **and** shipped to the **published page** separately — `canvas.scripts` are
  editor-only and never appear in `editor.getHtml()`.

---

## 7. Risks / open questions

- **Two artifacts to keep in sync** (custom element + GrapesJS type). The manifest
  mitigates drift for the *contract*, not the behavior.
- **Shipping the element JS to the published site.** Prefer the component-related
  pattern (element injects its own `<script src>` if undefined) so the dependency lands
  in the export only when used — mirrors the GrapesJS "Dependencies › Component related"
  guidance.
- **React/Next interop on the published page.** Light-DOM custom elements coexist with
  React fine when driven by attributes; confirm SSR emits the tags un-upgraded and the
  element upgrades on hydration without layout shift.
- **Manifest → Langfuse prompt sync.** The AI context lives in Langfuse in production;
  decide whether the manifest-generated section is injected at request time or baked
  into the authored prompt.

---

## 8. Suggested first slice (prove it end-to-end)

1. Build `<tc-accordion>` / `<tc-accordion-item>` as light-DOM, self-healing custom
   elements with an `editing` attribute.
2. Write their `InteractiveDescriptor`s in the manifest.
3. Wire the manifest → GrapesJS blocks/types **and** → the codegen prompt section.
4. Register the element in `canvas.scripts` and confirm it upgrades in-canvas.
5. Ask the copilot to "add an accordion" → verify it emits `<tc-accordion>`, the block
   renders, stays editable, styles via the Style Manager, and works on preview/publish.

Once the accordion round-trips through **author → AI-edit → publish**, replicate for
tabs and dialog.

---

## 9. Prior art: `knadh/oat`

[`knadh/oat`](https://github.com/knadh/oat) is a zero-dependency, CSS-first, **light-DOM**
web-component library. Its `ot-tabs` (`src/js/tabs.js`) is almost exactly this design's
runtime pattern and is worth reading before implementing. Two methods carry it:

- **`init()`** reads `:scope > [role="tablist"]` and `:scope > [role="tabpanel"]`,
  **self-heals by index** (generates missing ids, wires `aria-controls` /
  `aria-labelledby`), delegates `click`/`keydown` to the tablist, and activates the tab
  marked `aria-selected="true"` (else index 0).
- **`#activate(idx)`** toggles `aria-selected` + roving `tabIndex` on tabs, `hidden` on
  panels, and emits an `ot-tab-change` event.
- All components extend a thin **`OtBase`** (`src/js/base.js`): lazy `connectedCallback`
  init, `disconnectedCallback → cleanup()`, an `handleEvent` dispatcher (write `onclick`
  / `onkeydown` methods), `keyNav` roving focus, `emit`, `uid`.

### Borrow directly
- **`OtBase`-style thin base class** shared across accordion / tabs / dialog.
- **Self-heal by index** — the ~6-line id + ARIA wiring that removes the id-matching
  failure mode (the whole point of the AI angle).
- **`handleEvent` delegation** + **roving `tabIndex`** + **`hidden`-toggling**.
- Tabs as `<button>` (no `preventDefault` needed) rather than anchors — cleaner than
  `grapesjs-tabs`, which uses anchors and must suppress default navigation.

> **APG gap to close, don't inherit:** oat's `#activate()` sets roving `tabIndex` on tabs
> and `hidden` on panels but does **not** put `tabindex="0"` on the tabpanel, and
> `grapesjs-tabs` implements click only (no arrow/Home/End keyboard nav). Our element must
> add both to meet the APG Tabs — Automatic Activation spec (see §5.2).

### Where we diverge — authoring contract
oat's contract is **role attributes on two parallel lists**: a `role="tablist"` of N
tabs, then N separate `role="tabpanel"`s, paired **purely by index** (the Nth tab ↔ Nth
panel). That is great for progressive enhancement but wrong for our two consumers:

- **AI codegen** — two index-aligned parallel lists are exactly what an LLM mis-orders.
- **GrapesJS drag editing** — an author could reorder tabs but not panels and silently
  break the pairing.

Our **colocated** contract (`<tc-tab label="…">…content…</tc-tab>`) keeps label + panel
in one element: no ordering to get wrong, smaller emit surface, and tabs move as a unit
during drag. **Plan:** adopt oat's runtime mechanics, but have the element *build* the
internal `role="tablist"` / `tabpanel` structure from the colocated tabs — oat's a11y
wiring with our AI/edit-friendly authoring.
