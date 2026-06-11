# Architecture — technical

A map of how the pieces wire together. For any single subsystem, jump to its own
technical doc.

## The data format

Everything centers on the GrapesJS **project JSON** (`ProjectData` /
`ProjectDefinition`). Shape:

```
project
  pages[]
    frames[]
      component        ← the root component (a "wrapper", maps to <body>)
        components[]    ← recursive child component tree
  styles[]             ← flat list of CSS rules (selectors + style object)
  dataSources[]
```

A **component** node carries: `type` (GrapesJS type or custom), `tagName`,
`attributes`, `classes`, `components` (children), `content` (for text nodes). A
**style rule** carries selectors, a style object, optional `mediaText`/`atRuleType`,
and our custom `protected` flag.

Types: `lib/plugins/react-renderer/project/types.ts`.

## Module dependency map

```
app/admin/(editor)/.../edit/page.tsx   (RSC route)
        │ loads data + binds server actions
        ▼
components/page-builder/editor-shell.tsx   (client)
        │ configures + mounts
        ▼
GrapesJS  ◄── plugins (order matters, see editor-ui.technical.md):
        │      parserPostCSS, tcRemoteStorage, designSystemPlugin,
        │      reactRendererPlugin.init({components: patternComponents}),
        │      gjsBlocksBasic, columnsPlugin, patternsPlugin,
        │      templateRefPlugin, templateBlocksPlugin, styleFilter, styleBg
        │
        ├── React chrome (components/page-builder/{left,right}-panel, top-bar,
        │   managers/, style-fields/, trait-fields/) via @grapesjs/react providers
        │
        └── autosave → lib/plugins/tc-storage-adapter (tc-remote)
                     → lib/cms/editor-draft-actions.saveEditorDraft → Postgres.draftData

publish path: editor-shell augmentedSave → lib/cms/page-actions.savePage → Postgres.data

render path: app/preview/... → lib/cms/templates.resolvePageTree
           → components/page-builder/page-preview.tsx
           → lib/plugins/react-renderer/project (RenderComponent)
```

## Where the layers live (authoritative paths)

| Concern | Path |
|---|---|
| Editor shell + config + plugin order | `components/page-builder/editor-shell.tsx` |
| Custom React UI (panels, managers, fields) | `components/page-builder/` |
| React renderer — editor side | `lib/plugins/react-renderer/` (top-level) |
| React renderer — server side | `lib/plugins/react-renderer/project/` |
| Content blocks | `lib/plugins/patterns/`, `lib/plugins/columns/` |
| Templates | `lib/plugins/template-*.ts`, `lib/cms/template*.ts` |
| Theme | `lib/theme/`, `lib/plugins/design-system-plugin.ts`, `lib/tokens/` |
| Storage adapter + dirty store | `lib/plugins/tc-storage-adapter.ts`, `lib/page-builder/save-status-store.ts` |
| Server data layer | `lib/cms/` |
| Preview routes | `app/preview/`, `app/api/preview/` |
| Schema | `prisma/schema.prisma` |

## Cross-cutting invariants worth knowing day one

- **Import Prisma from `generated/prisma`**, never `@prisma/client`. Client is wired
  through `@prisma/adapter-pg` in `lib/prisma.ts`.
- **Protected styles are filtered on every write.** `filterProtectedStyles`
  (`tc-storage-adapter.ts`) runs on autosave *and* publish so theme CSS never lands
  in a page blob. The preview render filters again defensively for legacy rows.
- **The editor seeds from `draftData ?? data`** and skips GrapesJS's initial storage
  load (`projectData` init option + `autoload: false`).
- **`EditorShell` is fully client-deferred** (`mounted` gate) to avoid RSC hydration
  mismatches from GrapesJS + Base UI portals.
- **`var(--tc--preset--*)`** is the theme token naming scheme. It resolves both
  inside the canvas iframe and on the outer document (mirrored by `useApplyThemeVars`).
- **Next.js 16 cache tags** (`lib/cms/cache-tags.ts`) + `updateTag()` drive
  revalidation after mutations.

## Reading order for a new engineer

1. `prisma/schema.prisma` — the nouns.
2. `components/page-builder/editor-shell.tsx` — how it all boots (the doc comments
   here are excellent; read them).
3. `lib/plugins/react-renderer/project/render-project.tsx` — the render entry.
4. `lib/theme/compile.ts` — how a theme becomes CSS.
5. `lib/cms/page-actions.ts` + `tc-storage-adapter.ts` — the save lifecycle.
