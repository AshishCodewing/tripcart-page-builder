# Architecture

The page builder is four layers stacked on one shared data format: a **GrapesJS
project JSON** (a tree of components + a list of CSS rules).

```
┌──────────────────────────────────────────────────────────────┐
│  EDITOR  (browser)                                             │
│  EditorShell → GrapesJS + plugins, wrapped in a React UI       │
│  edits the project JSON live                                   │
└───────────────┬────────────────────────────────────────────────┘
                │ autosave (draftData)  /  publish (data)
                ▼
┌──────────────────────────────────────────────────────────────┐
│  DATA  (Postgres via Prisma)                                  │
│  Tenant · Page · Post · Template — each stores project JSON   │
└───────────────┬────────────────────────────────────────────────┘
                │ read saved JSON
                ▼
┌──────────────────────────────────────────────────────────────┐
│  RENDER  (server, RSC)                                        │
│  React Renderer walks the JSON → React tree, server-side      │
│  + tenant Theme compiled to CSS variables layered on top      │
└──────────────────────────────────────────────────────────────┘
```

## The four layers

1. **Editor** (`components/page-builder/`). `EditorShell` boots a GrapesJS instance
   with our plugin stack and replaces GrapesJS's default panels with a custom React
   chrome. GrapesJS is the source of truth for the document while editing.

2. **Plugins** (`lib/plugins/`). Everything custom about the builder is a GrapesJS
   plugin: the React renderer, the content blocks (patterns, columns), the template
   system, and the storage adapter. The plugin order in `EditorShell` matters
   (see editor-ui.technical.md).

3. **Data** (`lib/cms/` + `prisma/`). Server reads and `"use server"` actions.
   Content is JSON in a `data` column, with an in-progress `draftData` column for
   autosave.

4. **Render** (`lib/plugins/react-renderer/project/` + `app/preview/`). A
   server-side renderer reads the JSON and produces a React tree — no GrapesJS, no
   browser — so published pages are plain RSC output.

## Key idea: one document, three renderers

The same project JSON is rendered three different ways:

- **In the editor canvas** — by the React renderer's *editor-side* code, live and
  interactive, bound to GrapesJS models.
- **On the server** — by the React renderer's *project* module, for preview/publish.
- **As CSS** — the style rules in the JSON, plus the tenant theme compiled separately.

This is why our blocks can be authored as real React components and stay React the
whole way through.

## Key idea: content vs. theme are separate

A page's JSON carries only **page-specific** styles. The tenant's brand (colors,
typography, spacing) lives in the **Theme** and is compiled to CSS variables
injected separately — into the canvas while editing, and via a cached stylesheet on
preview. "Protected" theme rules are actively filtered out of the page blob on every
save so the theme is never duplicated or stale. See [theming.md](theming.md).

## Key idea: multi-tenancy

Every Page/Post/Template (templates can also be global) belongs to a Tenant. Paths
and slugs are unique *per tenant*, so two tenants can both own `/about`. Tenant
templates can *shadow* global ones of the same slug. See [templates.md](templates.md).

## Request lifecycles

**Editing:** `app/admin/(editor)/pages/[id]/edit` (RSC) loads the page +
`draftData ?? data` + tenant theme + templates, binds server actions, and renders
`<EditorShell>`. The shell is client-only (GrapesJS needs `window`).

**Previewing:** the editor links to `/api/preview?tenantId&path`, which enables
Next.js draft mode and redirects into `/preview/[tenantId]/...`. That route loads the
saved JSON, resolves template refs, and server-renders it. The tenant theme CSS is
injected by the preview layout.

**Publishing:** the editor posts the live JSON to a `savePage`/`savePost` action,
which writes `data`, clears `draftData`, flips status, and invalidates cache tags.

See [persistence.md](persistence.md) and [preview.md](preview.md) for the details.
