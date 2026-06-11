# Page Builder Handbook

Start here. This is the developer onboarding guide for the Tripcart page builder.

## What this is

A multi-tenant, visual website builder. Editors drag blocks onto a canvas, style
them, and publish. Under the hood it is **GrapesJS** (the drag-and-drop engine)
wrapped in a **custom React UI**, with content stored as JSON in **Postgres** and
rendered back to React both in the editor and on the public/preview site.

```
Stack: Next.js 16 (App Router, RSC) · React 19 · TypeScript (strict)
       GrapesJS 0.22 + @grapesjs/react · Prisma 7 / Postgres · Tailwind v4 · shadcn/ui
```

## The one-paragraph mental model

A **Tenant** owns **Pages**, **Posts**, and **Templates**, plus a brand **Theme**.
Editing a Page opens the **EditorShell**, which boots GrapesJS with our plugins and
renders a WordPress-style React chrome (left panel = blocks/layers, right panel =
style/settings, top bar = save/publish). GrapesJS holds the document as a JSON tree
of components + CSS rules. As you edit, that JSON is **autosaved to `draftData`**;
hitting Publish writes it to `data`. The public/preview routes read that JSON and
**render it to React on the server** — including our React-backed blocks — so a
`<HeroSection/>` stays a real React component end to end. The tenant's theme is
compiled to CSS variables (`--tc--preset--*`) and layered on top, never baked into
the page blob.

## How to read this handbook

Each topic has **two** docs:

- **`<topic>.md`** — concise. The mental model and key concepts. Read these first.
- **`<topic>.technical.md`** — a map into the code: which files do what, key
  contracts, and the gotchas that aren't obvious from reading the source. These
  point you at the code; they don't replace it.

## Topics

| Topic | Concise | Technical | What it covers |
|---|---|---|---|
| Architecture | [architecture.md](architecture.md) | [architecture.technical.md](architecture.technical.md) | The big picture, data flow, how the pieces connect |
| Editor & UI | [editor-ui.md](editor-ui.md) | [editor-ui.technical.md](editor-ui.technical.md) | EditorShell, the custom React chrome, Style/Trait managers |
| React Renderer | [react-renderer.md](react-renderer.md) | [react-renderer.technical.md](react-renderer.technical.md) | JSON→React, the editor plugin + the server renderer |
| Theming | [theming.md](theming.md) | [theming.technical.md](theming.technical.md) | Theme document, compile to CSS vars, design-system plugin |
| Blocks & Patterns | [blocks-patterns.md](blocks-patterns.md) | [blocks-patterns.technical.md](blocks-patterns.technical.md) | Custom GrapesJS blocks: patterns + columns |
| Templates | [templates.md](templates.md) | [templates.technical.md](templates.technical.md) | Reusable layouts/patterns/parts, synced refs vs copies |
| Persistence | [persistence.md](persistence.md) | [persistence.technical.md](persistence.technical.md) | CMS data layer, autosave vs publish, storage adapter |
| Preview & Publishing | [preview.md](preview.md) | [preview.technical.md](preview.technical.md) | Draft mode, preview routes, the public render path |

## Where things live

```
app/admin/(editor)/…/edit   Editor routes (page/post/template) → mount EditorShell
app/admin/(shell)/tenants   Admin CRUD: pages, posts, library, theme
app/preview/[tenantId]      Draft-mode preview render of saved JSON
app/api/preview             Enter/exit draft mode; compiled theme CSS endpoint

components/page-builder      The whole editor UI (shell + chrome + style fields)
lib/plugins                  GrapesJS plugins (react-renderer, patterns, columns, templates, storage)
lib/cms                      Server data layer (Prisma reads + "use server" actions)
lib/theme                    Theme schema, compile, presets, client store
lib/tokens                   Bundled default theme + Open Props mapping
prisma/schema.prisma         Tenant / Page / Post / Template models
```

## First-day checklist

1. `pnpm install` (runs `sync-vendor-css` automatically), set `DATABASE_URL` in `.env`.
2. `pnpm prisma migrate dev` then `pnpm dev`.
3. Read [architecture.md](architecture.md), then open a Page in the editor and watch
   the Network tab: you'll see `saveEditorDraft` autosaves fire as you type.
4. Skim [react-renderer.md](react-renderer.md) and [theming.md](theming.md) — those
   two systems are the ones most worth understanding deeply.

> Conventions: pnpm only. Prettier (no semicolons, double quotes) — run `pnpm format`,
> don't hand-format. Import the Prisma client from `generated/prisma`, not
> `@prisma/client`. The `@/*` path alias maps to the repo root.
