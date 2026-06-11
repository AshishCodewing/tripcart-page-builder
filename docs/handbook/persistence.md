# Persistence

How content is stored, autosaved, and published. The data lives in Postgres (via
Prisma); the server data layer is `lib/cms/`.

## The nouns

- **Tenant** — owns pages/posts/templates + a brand theme + a `themeVersion` counter.
- **Page** — tree-structured (`parentId`), addressed by `path`, unique per tenant.
- **Post** — flat, addressed by `slug`, unique per tenant; has categories/tags.
- **Template** — see [templates.md](templates.md).

## `data` vs `draftData`

Every Page/Post/Template has two JSON columns:

- **`data`** — the committed/published content. This is what the public site renders.
- **`draftData`** — the in-progress editor autosave. `null` means "no draft ahead of
  `data`".

The editor always seeds from **`draftData ?? data`**. Publishing writes `data` and
clears `draftData`.

## Two write paths

```
            ┌─ autosave (continuous, background) ─┐
edit canvas │                                     │ → draftData   (silent)
            └─ debounced ~1s, fire-and-forget ────┘

            ┌─ Save / Publish (explicit) ─────────┐
click button│                                     │ → data + status, clears draftData
            └─ filters theme rules, invalidates ──┘   (toast on publish)
```

### Autosave → `draftData`

As you edit, GrapesJS's storage manager fires `store`. Our custom **`tc-remote`**
storage adapter filters out protected theme rules and calls the bound
`saveEditorDraft` server action (debounced ~1s in the shell). It's a crash-recovery
net — silent on success, a toast only on failure. It never touches `data`.

### Save / Publish → `data`

Submitting the editor form runs `augmentedSave`: it copies the live, theme-filtered
project JSON into the form and calls `savePage`/`savePost`. That writes `data`, sets
`status`/`publishedAt`, clears `draftData`, and invalidates the relevant cache tags.

## Why theme rules are filtered out

On both write paths, `filterProtectedStyles` strips the theme's CSS rules so they're
never baked into the page blob (the theme is injected separately — see
[theming.md](theming.md)). This keeps the theme authoritative and avoids stale
snapshots winning the cascade.

## Paths, slugs, tenancy

- Page `path` is computed by walking the `parentId` chain (`about` → `about/team`).
- Uniqueness is **per tenant** (`(tenantId, path)`, `(tenantId, slug)`), so tenants
  can share URLs. Sibling slugs are unique under a parent.
- Slugs are validated; some top-level segments are reserved (`blog`, `admin`, `api`,
  `_next`). Reparenting can't create a cycle.

## Dirty state

A module-global `editorSaveStore` tracks whether the canvas has unsaved edits
(`markDirty` on every change, `committed` after a successful save). The top bar reads
it (`useIsDirty`) to label the primary button and to guard navigation.

For server-action signatures, the storage adapter contract, cache-tag conventions,
and the style-extraction helpers, see [persistence.technical.md](persistence.technical.md).
