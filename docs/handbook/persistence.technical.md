# Persistence — technical

Read [persistence.md](persistence.md) first. Server layer is `lib/cms/`; Prisma client
comes from `generated/prisma` via `lib/prisma.ts` (`@prisma/adapter-pg`).

## Files

| File | Responsibility |
|---|---|
| `lib/cms/pages.ts` / `posts.ts` | Reads (`getPageById`, `listPageParents`, …). |
| `lib/cms/page-actions.ts` / `post-actions.ts` | `"use server"` create/save/delete. |
| `lib/cms/tenants.ts` / `tenant-actions.ts` | Tenant reads + theme write. |
| `lib/cms/editor-draft-actions.ts` | `saveEditorDraft(kind, id, project)` — autosave sink. |
| `lib/cms/path.ts` | `buildPath`, slug validation, `assertNotDescendant`. |
| `lib/cms/cache-tags.ts` | Tag string conventions. |
| `lib/cms/style-extract.ts` | Subtree CSS extraction + id remap (used by templates). |
| `lib/plugins/tc-storage-adapter.ts` | The `tc-remote` GrapesJS storage type + `filterProtectedStyles` + `getPageStyles`. |
| `lib/page-builder/save-status-store.ts` | Module-global dirty store + `useIsDirty`. |

## The autosave sink — `saveEditorDraft(kind, id, project)`

`"use server"`. Pages/posts write `project` straight to `draftData`; templates run
`slimTemplateProject(project)` first. Bound per record in the editor route
(`saveEditorDraft.bind(null, "page", id)`) and passed to the shell as `persistDraft`.

## The storage adapter — `tc-storage-adapter.ts`

`tcRemoteStorage(persistDraft, initialProject)(editor)` registers a `tc-remote`
Storage type:
- `load()` → returns `initialProject` (a fallback; the shell seeds via `projectData`
  + `autoload: false`, so the initial load is skipped).
- `store(data)` → `await persistDraft(filterProtectedStyles(data))`.

`filterProtectedStyles(project)` drops `styles[]` entries with `protected === true`
(reference-preserving if nothing changed). `getPageStyles(editor)` reads the live CSS
rules minus protected ones (for convert-to-template).

The shell wraps `persistDraft` in a trailing 1s debounce, resolves the storage promise
immediately (GrapesJS isn't blocked on the network), and flushes any pending draft on
unmount.

## Explicit save — `savePage(id, form)` / `savePost(id, form)`

`"use server"`. Reads metadata (`slug`, `title`, `parentId`, `status`) + optional
`data` from the FormData. When `data` is present (editor commit): writes `data` and
sets `draftData: Prisma.DbNull`. Sets `publishedAt` on first publish. Recomputes
`path` via `buildPath` when slug/parent change (published pages can't be
renamed/reparented at MVP). Invalidates tags, may `redirect`.

The client side (`editor-shell.tsx` `augmentedSave`) is what stuffs
`filterProtectedStyles(editor.getProjectData())` into `form.data` and calls
`editorSaveStore.committed()` after success.

## Paths — `path.ts`

`buildPath(slug, parentId)` walks parents (cap 32) and joins slugs with `/`.
`validateSlug` (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), `validateTopLevelSlug` (reserved:
`blog`, `admin`, `api`, `_next`), `assertNotDescendant` prevents reparent cycles.

## Cache tags — `cache-tags.ts` + Next.js 16

`page(path)`, `post(slug)`, `postIndex`, `nav`, `tenants`, `tenantTheme(tenantId)`,
`template(slug)`. Server actions call `updateTag(...)` after mutations (e.g. `savePage`
invalidates old+new `page(path)` and `nav` when publish status changes;
`updateTenantTheme` invalidates `tenantTheme(id)` + `nav`).

## Dirty store — `save-status-store.ts`

`editorSaveStore`: `get()`, `subscribe(fn)`, `markDirty()`, `committed()`. Wired in the
shell: `editor.on("update", markDirty)`, `committed()` after save and on record
switch. `useIsDirty()` (`useSyncExternalStore`) feeds the top bar's button + guard.

## Style extraction — `style-extract.ts` (pure, client-safe)

`collectComponentIdentity` (ids+classes in a subtree), `extractStylesForSubtree`
(filter page rules to a subtree), `collectStyledIds`, `remapStyleIds` (re-key id
selectors for unsynced template re-drops). See [templates.technical.md](templates.technical.md).

## Lifecycle summary

```
edit → markDirty → tc-remote.store → filterProtectedStyles → debounce(1s)
     → saveEditorDraft → Postgres.draftData            (data untouched, dirty=true)

publish → augmentedSave → filterProtectedStyles(getProjectData())
     → savePage(data, status) → Postgres.data + draftData:null + status
     → updateTag(...) → editorSaveStore.committed()    (dirty=false)

reopen → route loads draftData ?? data → projectData seed → committed()
```
