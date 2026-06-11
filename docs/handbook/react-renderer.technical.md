# React Renderer — technical

Two subsystems sharing the project-JSON format. Read [react-renderer.md](react-renderer.md)
first for the split.

## A. Editor-side plugin — `lib/plugins/react-renderer/` (top level)

Installed via `reactRendererPlugin.init({ components })` in `editor-shell.tsx`.
Must register **before** `patternsPlugin` (it installs the type registry and the
`block:add` JSX processor that patterns rely on).

| File | Responsibility |
|---|---|
| `index.ts` | Plugin entry (`installRenderer`). Wires `Canvas.config.customRenderer = renderRoot`, `Components.config.processor = processReactElements`, registers components, hooks block/page events. Re-exports public types + `processReactElements`. |
| `register.ts` | `registerComponents`: for each config entry, `Components.addType` with `droppable`/`stylable`/`traits` derived from config. Patches every type's `toJSON` to preserve `tagName` (GrapesJS drops it for typed components otherwise). |
| `process.ts` | `processReactElements` — converts a React element tree into a GrapesJS component **definition** (function comp → registered type, string tag → type-or-tagName, `className`→`classes`, camelCase `style`→kebab, children→`components`). Also `manageReactBlockContent` / `manageReactPageContent`. |
| `render-root.tsx` | `renderRoot` — mounts a React root on the iframe `document.body`; cleans up on frame/window unload (unmount queued as a microtask — React 19 forbids sync unmount mid-commit). |
| `render-component.tsx` | `RenderCanvasComponent` + `useCanvasRender` — recursive live render; subscribes to `components:update`/`attributes:update`/`classes:update`/`rerender` and bumps a key. `connectDom` binds the rendered element back to the GrapesJS view. |
| `bind.ts` | `bindComponentToElement` — extends GrapesJS's `ComponentView` so it *adopts* React's DOM instead of creating its own (lifecycle methods become no-ops; `render` reduces to attribute sync). |
| `attrs.ts` | `attrsToReactProps` — GrapesJS attribute bag → React props (`class`→`className`, SVG camelCasing, drops `false` non-boolean attrs, parses `style`). |
| `style.ts` | Style normalization both directions (`camelKeysToKebabStyle`, `normalizeStyleObject`, case helpers). |
| `types.ts` | `ComponentConfig`, `RendererReactOptions`, `ErrorType`, etc. |

**`ComponentConfig` knobs** (`types.ts`): `component`, `allowChildren` (droppable),
`allowPropId` / `allowPropClassName` (style/selector manager scope), `props()`
(traits), `model` (GrapesJS defaults), `editorRender` (override canvas render),
`wrapperStyle`.

## B. Server-side renderer — `lib/plugins/react-renderer/project/`

No GrapesJS, no browser. Consumes `editor.getProjectData()` JSON.

| File | Responsibility |
|---|---|
| `render-project.tsx` | `RenderProject` — entry. Builds a `ProjectEditor`, picks page (by id or first) → frame → root component, then renders full page or a subtree (when `componentId` given). Throws typed errors (`NoPagesFound`, `PageNotFound`, `MissingRootComponent`, …). |
| `render-page.tsx` | `RenderPage` — wraps root in `<html><head>…</head><body>`, inlines CSS into `<head>`. |
| `render-component.tsx` | `RenderComponent` — recursive node→`createElement`. Resolves `type` against `config.components` else `tagName` else `div`. Coerces numeric-string props for registered React components. Stable `key`/`id` via `util.getComponentId`. |
| `models.ts` | Read-only mirrors: `ComponentNode` (type→tagName map, merged attributes incl. classes+id), `Frame`, `Page`, `Pages`, `DataSourceManager`, `findComponentById`. |
| `css-composer.ts` | `CssComposer` — stringifies the `styles[]` array to CSS text. Groups/sorts media queries (min-width ascending, else descending), normalizes selectors, handles `!important` (bool or property list). |
| `project-editor.ts` | `ProjectEditor` façade — `.Css` + `.Pages` + `.DataSources`, mimicking the live editor's surface. |
| `render-error.tsx` | Error fallback. |
| `index.ts` | Public barrel (`RenderProject`, `RenderComponent`, `ProjectEditor`, `CssComposer`, types). |

In this app, `PagePreview` (`components/page-builder/page-preview.tsx`) uses
`ProjectEditor` + `RenderComponent` directly (rendering the wrapper's children inline
since the host layout already provides `<html>/<body>`), rather than `RenderPage`'s
full document.

## Data flows

**JSX block → GrapesJS definition** (editor):
`Blocks.add({ content: <JSX/> })` → `manageReactBlockContent` → `processReactElements`
walks the tree → stashes original on `block.reactContent`, replaces `content` with a
definition.

**Live edit → canvas** (editor):
edit → model event → `useCanvasRender` key bump → `RenderCanvasComponent` re-render →
`connectDom`/`bindComponentToElement` re-sync view.

**Saved JSON → HTML** (server):
`getProjectData()` → `ProjectEditor` → `RenderProject`/`RenderComponent` recursion +
`CssComposer.getCssAsString()` inlined.

## Gotchas (documented in source)

- `toJSON` is patched to keep `tagName` — without it, custom-typed components
  round-trip without their tag (`register.ts`).
- `false` non-boolean attributes are dropped before reaching the DOM (React warns)
  (`attrs.ts`).
- Text/RTE components get a key bump every render to force remount and avoid stale
  RTE state (`render-component.tsx`).
- Frame-unload unmount is deferred to a microtask (React 19) (`render-root.tsx`).
- Media-query sort order is deliberate (mobile-first cascade) (`css-composer.ts`).
- The project module is intentionally GrapesJS-free so it runs in publish/static
  contexts (`project/index.ts`).
