# Page / Post rendering pipeline

How a stored JSON document becomes rendered JSX — the App Router layout, the
database tables involved, template resolution, and the JSON→JSX renderer.

> The `preview/` tree is the **reader** side. The same renderer a separate
> public deployment will consume from this DB; here it is gated behind Next.js
> draft mode.

---

## App Router folder structure

```
app/
├── layout.tsx                          Root: ThemeProvider, <html suppressHydrationWarning>
│
├── admin/                              ── Editor / CMS dashboard (GrapesJS authoring) ──
│   ├── (shell)/tenants/[id]/
│   │   ├── pages/  posts/  library/  theme/    list + data-table views
│   └── (editor)/
│       ├── pages/[id]/edit/page.tsx    GrapesJS editor → autosaves to draftData
│       ├── posts/[id]/edit/page.tsx
│       └── templates/[id]/edit/page.tsx
│
├── api/preview/
│   ├── route.ts                        Enable draft mode → redirect to /preview/...
│   ├── exit/route.ts                   Disable draft mode → /admin
│   └── theme/[tenantId]/[version]/theme.css/route.ts   Compiled tenant theme CSS
│
└── preview/[tenantId]/                 ── Public-shaped render (draft-gated here) ──
    ├── layout.tsx                      Injects <link> to compiled theme CSS
    ├── [...slug]/page.tsx              Catch-all → renders a PAGE
    └── blog/
        ├── page.tsx                    Post index list
        └── [slug]/page.tsx             Renders a single POST
```

The route groups `(editor)` vs `(shell)` split the GrapesJS authoring surface
from the dashboard chrome without affecting URLs.

---

## Database tables & columns

```mermaid
erDiagram
    tenants ||--o{ pages : owns
    tenants ||--o{ posts : owns
    tenants ||--o{ templates : "owns (tenantId nullable)"
    pages ||--o{ pages : "parent (PageTree)"
    posts }o--o{ categories : "M2M"
    posts }o--o{ tags : "M2M"

    tenants {
        string id PK "cuid"
        string slug "unique route key"
        string domain "unique, nullable"
        json   theme "full Theme doc; {} = bundled default"
        int    themeVersion "bumped on write -> CSS cache key"
    }
    pages {
        string id PK
        string tenantId FK
        string slug
        string path "unique per tenant"
        string parentId "self-rel tree"
        string title
        json   data "PUBLISHED ProjectDefinition (reader renders this)"
        json   draftData "editor autosave; null = no draft"
        enum   status "DRAFT | PUBLISHED"
    }
    posts {
        string id PK
        string tenantId FK
        string slug "unique per tenant"
        string title
        string excerpt
        json   data "PUBLISHED ProjectDefinition"
        json   draftData "editor autosave"
        enum   status "DRAFT | PUBLISHED"
        datetime publishedAt
    }
    templates {
        string id PK
        string tenantId FK "NULL = global; set = tenant (shadows global)"
        string slug "referenced by data-slug on template-ref node"
        enum   kind "LAYOUT | PATTERN | PART"
        string area "header/footer... (required when PART)"
        bool   synced "true=live ref (propagates) / false=copy"
        json   data "slim { component, styles } subtree"
        json   draftData "editor autosave"
    }
```

**The key column split:** `data` is the published JSON the reader renders;
`draftData` is the in-progress editor autosave. The editor seeds from
`draftData ?? data`; the public render reads **`data` only**. Publish writes
`draftData → data` and clears the draft.

---

## Request → render data flow

```mermaid
flowchart TD
    URL["URL /preview/{tenantId}/{...slug}<br/>or /preview/{tenantId}/blog/{slug}"]
    Draft{"draftMode()<br/>enabled?"}
    NF["notFound() (404)"]
    Q["prisma.page.findUnique({ tenantId_path })<br/>or prisma.post.findUnique({ tenantId_slug, include: categories, tags })"]
    DATA["page.data / post.data<br/>(ProjectDefinition JSON)"]
    RESOLVE["resolvePageTree(tenantId, data)<br/>lib/cms/templates.ts"]
    TPL["for each node.type === 'template-ref':<br/>slug = attributes['data-slug']<br/>SELECT * FROM templates<br/>WHERE slug=? AND (tenantId=? OR tenantId IS NULL)<br/>ORDER BY tenantId → tenant WINS, global fallback<br/>splice template.data in-place; recurse (cycle-guard, memoize, dedupe css)"]
    MERGED["merged ProjectDefinition (+ accumulated styles)"]
    PP["&lt;PagePreview projectData config={components: patternComponents}/&gt;"]

    URL --> Draft
    Draft -- no --> NF
    Draft -- yes --> Q
    Q --> DATA --> RESOLVE --> TPL --> MERGED --> PP

    subgraph layout["preview/[tenantId]/layout.tsx (wraps subtree)"]
        TV["SELECT themeVersion FROM tenants WHERE id=?"]
        LINK["&lt;link href='/api/preview/theme/{tenantId}/{version}/theme.css'&gt;"]
        CSS["route compiles tenants.theme JSON → CSS (served immutable)"]
        TV --> LINK --> CSS
    end
    URL -.-> layout
```

---

## JSON → JSX conversion (the renderer)

`lib/plugins/react-renderer/` turns the stored `ProjectDefinition` into React
elements — **no GrapesJS at runtime.**

```mermaid
flowchart TD
    JSON["ProjectDefinition JSON<br/>{ styles:[Rule], pages:[{frames:[{component:{tree}}]}], dataSources, assets }"]
    PE["new ProjectEditor(json) — project-editor.ts"]
    CSS["CssComposer(styles).getCssAsString()<br/>Rule[] → CSS string (@media/@keyframes grouped)"]
    ROOT["Pages.getAll()[0].frames[0].component = root node"]
    RC["RenderComponent(node, config) — RECURSIVE CORE<br/>render-component.tsx:10"]

    NULLN["node === null → null"]
    TEXT["type === 'textnode' → node.content (raw string)"]
    TAG["resolve tag:<br/>config.components[type]?.component (React pattern)<br/>?? node.tagName (intrinsic HTML)<br/>?? 'div'"]
    PROPS["attrsToReactProps(node.attributes)<br/>class→className, for→htmlFor, kebab→camel,<br/>style normalized, data-*/aria-* pass through"]
    KIDS["children = node.components.map(RenderComponent) ◄ recurse"]
    EMIT["isReactCmp ? &lt;Tag {...props}&gt;{children}&lt;/Tag&gt;<br/>: createElement(Tag, props, isVoid ? null : kids)"]
    OUT["&lt;PagePreview&gt; emits tree + &lt;style&gt;{pageCss}&lt;/style&gt;<br/>(root children inline — Next layout owns html/body)"]

    JSON --> PE
    PE --> CSS
    PE --> ROOT --> RC
    RC --> NULLN
    RC --> TEXT
    RC --> TAG --> PROPS --> KIDS --> EMIT --> OUT
    CSS --> OUT
```

### Pattern components

The map that makes "JSON → real React component" work is **`patternComponents`**
(`lib/plugins/patterns/index.ts`): `type → { component, props(), allowChildren }`.

A node like:

```jsonc
{ "type": "cta-section",
  "attributes": { "data-primary-label": "Get started" },
  "components": [ /* textnodes */ ] }
```

looks up `CtaSection`, its traits become typed props, and its GrapesJS children
render as JSX `children`. Any node **without** a registered type falls back to
its raw `tagName`, so plain markup round-trips as ordinary HTML elements.

---

## Pinned GrapesJS internals (check on upgrade)

The canvas half of `lib/plugins/react-renderer/` reaches into GrapesJS
internals that are **not part of the public API**. Pinned against
**grapesjs 0.22.16** — re-verify each on any GrapesJS upgrade:

- **`Components.config.processor` result is shallow-merged as a single
  object** (`processDef` → underscore `extend`). The processor can never
  return an array, so a transparent Fragment that flattens to multiple
  children must be collapsed at the call site (`index.ts`): one child →
  the child; zero/multi → `{ components }` (materializes a default
  container — accepted limitation). `process.ts` / `index.ts`.
- **`Parser.parserHtml.splitPropsFromAttr(rest)`** splits a prop bag into
  `{ attrs, props }` (HTML attributes vs model-level props). `process.ts`.
- **`Components.ComponentView` + `.extend(...)`** — bind.ts subclasses the
  view to adopt React-owned DOM (overriding `initComponents`,
  `_createElement`, `_removeElement`, `__clearAttributes`, `render`, and
  calling `_ensureElement` / `_setData` / `renderAttributes` /
  `updateSrc`). `bind.ts`.
- **Backbone `setElement` reliance** — the existing-view rebind path calls
  `view.setElement(el)` to undelegate/re-delegate handlers (notably
  `dragstart`). NOTE: `setElement` does **not** redo the constructor-only
  wiring of `el.__gjsv` / `$el.data('model')`; if hover/select ever breaks
  post-rebind, re-add those in the else branch with evidence. `bind.ts`.
- **`ComponentView.frameView`** getter (= `opts.config.frameView`) — used
  for frame-scoped view teardown (`v.frameView === frameView`).
  `render-component.tsx`, `bind.ts`.
- **`Components.events`** keys (`update`, `removed`, plus the
  `update:components|attributes|classes` sub-events) drive the canvas
  re-render/teardown subscriptions. `render-component.tsx`.
- **`Canvas.config.customRenderer`** props shape — the per-frame render
  entry point the plugin installs. `index.ts`, `render-root`.

## One-line summary

`data` (JSON) → `ProjectEditor` parses it → `template-ref` nodes resolved from
the `templates` table → `RenderComponent` recurses the tree, mapping each node's
`type` to either a registered React pattern component or its HTML `tagName`,
converting `attributes`→props and `styles`→a CSS string → React renders it as a
server component.
