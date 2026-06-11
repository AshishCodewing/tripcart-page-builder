# Templates

Templates are **reusable content units** — a saved subtree (components + styles) that
can be inserted into pages. They power layouts, shared sections, and chrome like
headers/footers.

## Three kinds

- **LAYOUT** — a page-shaped starting point (has a content slot, often references
  parts). Used to scaffold a new page.
- **PATTERN** — a section-scoped block (hero, pricing, etc.), shown in the inserter
  alongside code-defined patterns.
- **PART** — area-tagged chrome (header, footer, sidebar). `area` is required.

## Two big dimensions

### Global vs. tenant (shadowing)

A template with `tenantId = null` is **global** (shared library); with a `tenantId`
it's **tenant-scoped**. A tenant template can **shadow** a global of the same slug —
the tenant version wins everywhere (UI lists and render resolution both prefer the
tenant row, global as fallback).

### Synced vs. copy

This is the important behavioral switch, chosen per template:

- **Synced** (`synced = true`) → inserted as a **`template-ref`** (a placeholder
  pointing at the slug). Resolved at render time, so **edits to the template
  propagate** to every page that references it. Think headers/footers.
- **Copy** (`synced = false`) → the subtree is **inlined** into the page on insert.
  Independent thereafter; later template edits don't touch existing copies. Think
  starting-point layouts/patterns.

## How a synced ref behaves

- **In the editor**, dropping a synced template adds a `template-ref` node that shows
  a **locked preview** of the resolved content (you can't edit it inline). The
  floating toolbar offers **"Edit original"**, which jumps to the template's editor.
- **On the page blob**, the ref saves as just `{ type: "template-ref", attributes: {
  "data-slug": … } }` — no inlined content.
- **At render**, the server walks the tree, looks up each ref's template, and
  **inlines** the resolved content + merges its styles, with cycle and depth guards.

## Creating a template

From the editor, select a component (or several) → floating toolbar → **Create
Pattern**. The dialog (`convert-template-dialog.tsx`) captures the subtree + its
page-scoped CSS, you pick kind/area/synced, and it's saved tenant-scoped. The new
template is immediately registered as a draggable block; if synced, your selection is
swapped in place for a `template-ref`.

## Storage shape

Templates store a **slim** body: `{ component, styles }` (not a whole page project).
There's no publish lifecycle — a template reaches the public site only by being
inserted into a Page/Post, which gates publication.

For the `template-ref` component type, the server resolver, draggable-block
registration, and style handling, see [templates.technical.md](templates.technical.md).
