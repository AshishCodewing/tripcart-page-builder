# Templates — technical

Read [templates.md](templates.md) first.

## Data model (`prisma/schema.prisma` → `Template`)

`kind` (LAYOUT|PATTERN|PART), `tenantId?` (null = global), `synced`, `slug`, `area?`,
`title`, `description?`, `data` (slim `{component, styles}`), `draftData?`, `preview?`.
Uniqueness: `@@unique([tenantId, slug])` plus a partial unique index
`(slug) WHERE tenantId IS NULL` for globals (added in migration SQL).

**Slim body** (`TemplateBody`): `{ component?: ComponentDefinition, styles?: Rule[] }`
with a legacy `pages?` fallback. `slimTemplateProject(project)` (templates.ts) reduces
a full editor `ProjectDefinition` to this shape — shared by save + autosave.

## Files

| File | Responsibility |
|---|---|
| `lib/plugins/template-ref.ts` | The `template-ref` GrapesJS component type, on-canvas locked preview, `tc:edit-template-ref` command + `TEMPLATE_REF_EDIT_EVENT`. |
| `lib/plugins/template-blocks.ts` | Registers tenant/global templates as draggable Block-Manager entries (`templateBlocksPlugin(templates)`). |
| `lib/plugins/template-styles.ts` | `applyTemplateStyles(editor, styles, {protect})` — dedup + inject template CSS into the live editor. |
| `lib/plugins/convert-to-template.ts` | `isConvertibleSelection`, `CONVERT_OPEN_EVENT`. |
| `lib/cms/templates.ts` | Reads (`listTemplates`, `loadTemplate`, `getTemplateIdBySlug`), `resolvePageTree` (the server resolver), `slimTemplateProject`. |
| `lib/cms/template-actions.ts` | `saveTemplate`, `createTemplateFromSelection`, delete; slug derivation + reference guards. |
| `lib/cms/template-shape.ts` | `unwrapTemplateRoot` — defang document-level roots (wrapper/body/html → div). |
| `lib/cms/style-extract.ts` | `extractStylesForSubtree`, `collectStyledIds`, `remapStyleIds` — pull a subtree's CSS out of page styles; re-key ids for unsynced re-drops. |
| `components/page-builder/convert-template-dialog.tsx` | Create-from-selection UI. |

## Shadowing rule (every read)

`ORDER BY tenantId ASC NULLS LAST, TAKE 1` — tenant row first, global fallback.
Applies to `loadTemplate`, `getTemplateIdBySlug`, `listTemplates`.

## `template-ref` component type (template-ref.ts)

- Type `"template-ref"`, slug in `data-slug`, HTML marker `data-template-ref`.
- `stylable: false`, `editable: false` (the original owns styles + content).
- **In-memory registries** (per editor, WeakMap): `refBodyRegistry` (slug→body),
  `refTitleRegistry` (slug→title), seeded from `templates` at plugin init and mutated
  by convert/template-blocks — so previews resolve with **no per-ref DB fetch**.
- `init()` resolves the body, appends it as **locked, non-layerable** children
  (preview only), stamps a transient depth attr, and applies template styles as
  **protected** rules (re-applied on `editor.on("load")`).
- `toJSON()` strips the inlined children + depth attr → the blob keeps only the slug.
- `onRender()` shows a labelled placeholder when unresolved
  (`unbound`/`missing`/`empty`/`max-depth`/`cycle`). Canvas preview depth cap = 8.
- "Edit original": toolbar runs `tc:edit-template-ref` → `TEMPLATE_REF_EDIT_EVENT` →
  `editor-shell.tsx` routes to `/admin/templates/by-slug/<tenant|global>/<slug>`
  (which redirects slug→id), guarded by the unsaved-changes dialog.

## Server resolver — `resolvePageTree(tenantId, data)` (templates.ts)

Returns a **new** `ProjectDefinition` with every `template-ref` inlined and template
styles appended to `styles[]`. Walk (`resolveNode`):
- depth cap 16; cycle guard via a `visiting` set; per-slug DB lookup memoized.
- on a ref: `loadTemplate` (shadowing) → `unwrapTemplateRoot` → recurse (depth+1);
  styles deduped per slug and appended **after** page styles (so outer templates win
  the cascade).
- unresolved refs become placeholder nodes (`missing:`/`cycle:`/`max-depth:`).

Called from the preview routes before handing JSON to `PagePreview`.

## Draggable blocks — `templateBlocksPlugin(templates)` (template-blocks.ts)

Per template, `registerTemplateBlock`:
- **synced** → block content is a static `template-ref` (`data-slug`), and the body +
  title are registered into the ref registries so it's immediately resolvable.
- **unsynced** → block content is the component subtree directly; its styles are
  seeded and, on `block:drag:stop`, **ids are regenerated** (`regenerateInstanceIds`
  + `remapStyleIds`) so multiple copies don't share `#id` rules. Applied with
  `protect: false` (the copy owns them).
- category by kind (Layouts/Patterns/Parts); `data-template` attribute; SVG thumbnail.

## Create-from-selection (convert-template-dialog.tsx + template-actions.ts)

Dialog captures `selected` (frozen at open), snapshots page CSS via `getPageStyles`,
extracts the subtree's rules (`extractStylesForSubtree`), and posts to
`createTemplateFromSelection` (multi-select wraps in a `data-template-fragment` div).
On success it `registerTemplateBlock`s immediately and, if synced, `replaceWith`s the
selection for a `template-ref`. Slugs derive from title with `-2/-3…` de-dup;
renaming a referenced template is guarded (`templateRefExists`).

## Style protection (template-styles.ts)

`applyTemplateStyles` skips rules already present (by selector+atRule key), never
flips an existing unprotected rule to protected, and only marks the fresh ones. Synced
previews use `protect: true` (stripped from the blob); unsynced drops use
`protect: false` (persisted). Mirrors `designSystemPlugin`'s protected-rule approach.
