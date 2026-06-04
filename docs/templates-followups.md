# Templates — Remaining Work

Tracks what still needs to land before the templates story is "complete." See `docs/templates.md` for the design and commit `af0e932` for the current shipped state.

## Status snapshot

### Shipped (commit af0e932)

- `templates` table with `TemplateKind` enum + nullable `tenantId` for globals.
- Partial unique index `(slug) WHERE tenantId IS NULL` for global-slug uniqueness.
- CMS read layer: `getTemplateById`, `getTemplateIdBySlug`, `listTemplates`, `loadTemplate` (tenant-first / global-fallback), `resolvePageTree` (recursive resolver with cycle guard + memoization).
- Write layer: `saveTemplate(id, form)` updates `data` + `status` only.
- `template-ref` GrapesJS component type — locked placeholder + "Edit" toolbar action.
- Edit-event wiring in editor shell → routes to `/admin/templates/by-slug/<tenant>/<slug>`.
- Slug→id redirect route + canonical id-based editor route.
- Right panel and top-bar branches for `kind: "template"`.

### Shipped (commit b2007eb + follow-up edits)

- Render-path integration — `resolvePageTree` is now called from the page and blog-post preview routes; synced `template-ref` nodes expand to their templates' content at render. Resolver signature now takes/returns `ProjectDefinition`; template styles merge into the project's `styles[]` (post-order, per-slug dedupe). See §1.
- Convert-to-template flow — toolbar "More" item (Pattern C) → shadcn dropdown anchored at the click rect → modal form (title, kind, area-when-PART, synced) → `createTemplateFromSelection` server action → optional `selected.replaceWith(template-ref)` when synced. Slugs derive from title with `-2`/`-3`/… collision suffix. See §2. **Style snapshot is over-inclusive** (copies the whole project `styles[]` into the new template) — see §6 for the precise-extraction follow-up.

### Shipped (later — doc was stale; reconciled 2026-05-29)

- **§9 slim `Template.data`** — migration `20260527171856_slim_template_data` reshapes rows to `{ component, styles }`; `saveTemplate` and `createTemplateFromSelection` write the slim shape; `resolvePageTree` reads `tplData.component` with a legacy `pages[0].frames[0].component` fallback; the template editor load path wraps back into the full project shape.
- **§8 block registration** — `templateBlocksPlugin(templates)` is wired into `editor-shell.tsx` and registers templates as draggable Block-Manager entries (category by kind, per-kind SVG thumbnails). **Synced** templates register a static `template-ref` placeholder; **unsynced** register their component subtree directly (`tpl.data.component`) and seed the subtree's `styles[]` into the page CSS on `block:drag:stop` (non-protected, so they persist). Registration is unified in `registerTemplateBlock` — used by both the init-time plugin loop and the convert dialog's register-on-create. See §8.
- **§6 precise per-subtree style extraction** — `lib/cms/style-extract.ts` (`collectComponentIdentity` + `extractStylesForSubtree`); the convert dialog now snapshots only the rules targeting the converted subtree (normalizing GrapesJS' shallow `toJSON` output to plain data first). See §6.
- **§7 on-canvas inline preview (incl. styles)** — `templateRefPlugin` is now a factory closing over `templates`; a `template-ref` inlines its referenced template's `data.component` as **locked, non-layerable** children so converted headers/heroes/footers show real content instead of a one-line label. Depth-guarded (`MAX_PREVIEW_DEPTH=8`) against cycles; `model.toJSON` strips the preview so nothing extra persists to `page.data`. The template's `data.styles` (the §6 subtree slice) are injected into the **CSS model as protected rules** (shared `applyTemplateStyles`) and re-applied on `editor.on("load")` — the `designSystemPlugin` pattern. Going through the model (not a detached iframe `<style>`) is what makes them survive reload/navigation, since GrapesJS re-renders its model into the canvas; `protected` keeps them out of saved data, and the dedupe never flips a page-owned rule to protected. Serialized with the same `CssComposer` the preview/publish path uses, so canvas matches the published render. See §7.

### Pending

- A way to create templates from scratch (no UI today). See §3.
- Editable template metadata (slug rename, kind change, area, synced toggle). See §4.
- Template delete action + reference-impact handling. See §5.
- **Pattern categories** on Templates so the block inserter can filter by category beyond just kind — matches WP's pattern-category UX. See §10.
- **Overrides on synced templates** — mark specific child components as per-instance-editable so a synced card layout can have a fixed structure with variable title/image. WP 6.6+ feature; closes a real gap in our synced model. See §11.
- **Headless thumbnail generation for `Template.preview`** — replace the per-kind placeholder SVGs with real renders. See §12.
- **Array-rooted templates (drop the multi-select wrapper `<div>`)** — currently the convert-from-selection flow wraps multiple selected blocks in a `<div data-template-fragment>` so the template keeps a single root. Switch the schema to support an array root so the resolver splices N siblings back into the parent without the wrapper. See §13.

Order below is "what unblocks what." Reorder as priorities shift. **Sequence note (resolved)**: §9 (slim shape) landed before §8 (block registration), as planned — the block snippet now reads `tpl.data.component` directly.

---

## 1. Render-path integration

**Status: shipped (commit b2007eb).** The notes below are kept for the public render path follow-up (the same hook needs to fire when the published render lands).

**What:** Call `resolvePageTree(tenantId, page.data)` in the preview render path before handing the tree to the GrapesJS HTML/CSS exporters. Same hook for the eventual published render path.

**Why:** Without this, synced `template-ref` nodes are stored in `Page.data` but never resolved at render — published pages would render the placeholder `<div data-template-placeholder="...">`, not the referenced template's content.

**Scope:**

- Find the call site in the preview route (likely `app/preview/[tenantId]/[...slug]/page.tsx` and `app/preview/[tenantId]/blog/[slug]/page.tsx`) where `Page.data` / `Post.data` is read.
- Wrap the read with `resolvePageTree(tenantId, data)` before passing to the React-renderer / HTML exporter.
- Memoization is already per-request inside `resolvePageTree`; no caller-side memo needed.

**Design notes:**

- Caching across requests is a future optimization. The pattern would mirror the theme system: bump a per-template `version` column on save, key the resolver cache on `(tenantId, slug, version)`, invalidate the `template:<slug>` tag (already in `cacheTags`).
- Cycle/missing/depth placeholders bubble up as `<div data-template-placeholder="...">`. The renderer should either show them visibly in dev (helpful debugging) or hide via CSS in prod.

**Estimated size:** small. Two-three call-site touches, plus one decision about how to surface placeholders.

---

## 2. Convert-to-template UX

**Status: shipped (MVP).** Notes below are preserved for context. Open carry-overs: §6 (precise style extraction) and §7 (canvas inline preview).

**What:** Toolbar button on every selectable component → modal asks for title + kind (+ area + synced) → creates a Template row → optionally replaces the selection in the page with a `template-ref`.

**Why:** This is the "Create Symbol" experience from the screenshot the user shared, but with Templates instead of Symbols. The only way to create a template today is to seed a DB row manually.

**Scope:**

- New server action `convertSelectionToTemplate(tenantId, form)` in `lib/cms/template-actions.ts`. Creates a Template row with `data = serializedSubtree`. If `synced=true`, returns the new template's slug so the client can swap the selection.
- New command `tc:convert-to-template` registered in a new plugin (`lib/plugins/convert-to-template.ts`) or inside the existing `template-ref.ts` plugin.
- Wire a toolbar item via **Pattern C** (subscribe to `component:selected`, mutate `cmp.get('toolbar')` — see "Toolbar extension reference" below).
- Modal: shadcn `Dialog` rendered from the React shell, opened by listening for an editor event the plugin fires. Form: title (required), kind (LAYOUT/PATTERN/PART), area (when PART), synced toggle. Defaults: kind=PATTERN, synced=false (matches WP's "Pattern (unsynced)" default).
- On `synced=true` submit: server action returns the new slug → client replaces selection's component with a `{ type: "template-ref", attributes: { "data-slug": slug } }` node.

**Design notes:**

- Don't show the toolbar item on a `template-ref` itself (it's already a ref; converting it would be a noop or confusing). Guard in the `component:selected` handler: `if (cmp.get('type') === 'template-ref') return`.
- Don't show on locked components.
- The toolbar item appears next to move/clone/delete — flat strip, no overflow menu yet. The overflow-menu UI from the symbols-demo screenshot is a separate UI layer (see "Deferred — overflow menu UX" below).

**Estimated size:** medium. New server action, new plugin, modal UI, selection-replacement logic.

---

## 3. Create-template-from-scratch UI

**What:** An admin index at `/admin/tenants/[id]/templates` showing the tenant's templates + a "Create template" button that opens a blank template editor.

**Why:** Convert-from-selection covers the common case, but you also need to be able to author a template starting from nothing — typically headers/footers built from `template-part` material.

**Scope:**

- New `createTemplate(form)` server action: creates a row with empty `data: {}`, redirects to `/admin/templates/[id]/edit`.
- Index page at `/admin/(shell)/tenants/[id]/templates/page.tsx`:
  - Server-render via `listTemplates(tenantId)`.
  - Table or grid: title, kind, area, synced, last edited, status.
  - "Create template" button → form modal → `createTemplate`.
- Also exposes a separate "Global library" route for the global table (admin-only).

**Design notes:**

- Permissions gate: writes with `tenantId IS NULL` are app-admin only. The action layer should enforce — DB allows null because business logic owns the rule.
- Where the link to the index lives: probably a "Templates" nav item in the tenant dashboard sidebar.

**Estimated size:** medium. Mostly UI work; the action is small.

---

## 4. Editable template metadata in the right panel

**What:** Replace the read-only badges in `TemplateOnlyFields` (right-panel.tsx) with real inputs for slug, kind, area, synced. Save through an expanded `saveTemplate` that accepts these fields.

**Why:** Today users can edit the canvas but not the metadata of a template they're editing. Renaming or swapping kind requires a DB edit.

**Scope:**

- Expand `saveTemplate(id, form)`:
  - Read slug, kind, area, synced from form.
  - Validate slug (kebab-case, length).
  - Block slug rename when status=PUBLISHED OR there are referencing `template-ref` nodes (we'd need to scan or warn — see "Open decisions").
  - Update Template row, bump cache tag, redirect if path changed.
- Right panel form fields:
  - Slug: write-once warning when refs exist.
  - Kind: select (LAYOUT/PATTERN/PART). Changing kind may invalidate `area`.
  - Area: input shown only when kind=PART.
  - Synced: toggle. Changes affect future inserts only (matches WP/our design).

**Design notes:**

- Slug rename is the dangerous one. Existing `template-ref` nodes in Page.data carry the old slug. Renaming breaks all refs to it. Options:
  1. Forbid rename when any refs exist (safe, restrictive).
  2. Update all matching refs across all Page rows on rename (transactional + tag-invalidate every affected page).
  3. Allow rename, let refs go stale + render placeholders, surface a warning.
- Recommend option 1 for MVP, lift to 2 when needed.

**Estimated size:** medium. Form fields + validation + the slug-rename policy.

---

## 5. Template delete + reference impact

**What:** Implement the "Move to trash" button for templates in the right panel. Decide what happens to `template-ref` nodes pointing at the deleted slug.

**Why:** The button is currently a no-op for templates. Without a delete action, the only way to remove a template is DB manipulation.

**Scope:**

- New `deleteTemplate(id)` server action: deletes the row, bumps `template:<slug>` cache tag, redirects to the templates index.
- Pre-delete check: count references (would require scanning `Page.data` / `Post.data` JSON for matching `template-ref` slug — non-trivial). For MVP, allow delete and let refs render placeholders.
- Optional: a "deleted-ref" placeholder variant that surfaces visibly so users notice.

**Design notes:**

- Cascade is intentionally NOT enabled at the DB level — referenced templates and their references aren't FK-linked (refs live inside JSON columns). Deletion is independent.
- Future enhancement: a "Reference inventory" view that scans for refs to a slug, so admins can see what would break before deleting.

**Estimated size:** small. The reference scan is the only uncertain bit; skipping it makes this trivial.

---

## 6. Precise per-subtree style extraction in convert-to-template

**Status: shipped (2026-05-29).** New pure module `lib/cms/style-extract.ts` exposes `collectComponentIdentity(node)` (walks a `ComponentDefinition` tree → `{ ids, classes }`) and `extractStylesForSubtree(allStyles, subtree)` (keeps only rules whose selectors reference a collected id/class). `ConvertTemplateDialog` now narrows the snapshot to the subtree instead of posting the whole page's `styles[]`. **Two normalization gotchas, both handled at the dialog boundary:** GrapesJS `rule.toJSON()` and component `toJSON()` are shallow — `selectors`, nested `components`, and `classes` can still be live Backbone models/collections whose fields hide behind `.get()`. The dialog `JSON.parse(JSON.stringify(...))`-normalizes both inputs to plain data before extraction (the same shape that gets posted/stored), so the extractor stays pure-data. The matcher handles all serialized selector shapes: bare class strings (`gjs-grid-row`), prefixed strings (`#secA` / `.a-box`), and `{ name, type }` objects (labeled component selectors). Verified end-to-end in the editor: a two-section scene where only the converted section's 3 rules ride along and the sibling's rules are excluded. **Not done (deferred):** stripping the moved rules from the source page on conversion (the doc's optional cleanup) — GrapesJS prunes orphaned rules on next save. The notes below are the original plan.

**What:** Replace the current "copy the entire project `styles[]` into the new template" MVP behavior in `ConvertTemplateDialog` (see `components/page-builder/convert-template-dialog.tsx`, where the dialog runs `filterProtectedStyles(editor.getProjectData())` and posts the whole `styles` array) with a precise extractor that includes only the CSS rules whose selectors reference IDs/classes inside the converted subtree.

**Why:** Today every conversion copies the full project `styles[]` into the new `Template.data.styles`. That keeps the synced ref renderable — the template carries the rules it needs — but it also drags along every unrelated rule from the page. Real-world cost:

- Templates grow noisier as the source page accumulates Style-Manager-edited rules.
- If multiple pages convert different blocks against a shared style pool, each template ends up with the union of every page's styles, not its own slice.
- Render-time merges (page styles + template styles) duplicate identical rules N times for N references — fine for correctness, wasteful in payload.

**Scope:**

- New helper in `lib/cms/templates.ts` or `lib/cms/style-extract.ts`:
  - `collectComponentIdentity(node)` — walks a `ComponentDefinition` tree recursively, collecting two sets: `ids` (from `attributes.id`, the top-level `id` field) and `classes` (from `classes[]` — strings or `{name}` objects).
  - `extractStylesForSubtree(allStyles, subtree)` — filters a `Rule[]` array down to rules whose `selectors[]` mention any collected id/class. Match strategy: tokenize each selector string and look for `#<id>`, `.<class>`, or bare-name matches (GrapesJS often stores selectors without the `#` / `.` prefix — type carries that info). Optional: word-boundary safety to avoid `foo` matching `foobar`.
- Wire it into the dialog's submit handler — replace the `projectStyles` snapshot with `extractStylesForSubtree(projectStyles, subtree)`.
- Decide whether to also strip the moved rules from the page on conversion. The current MVP relies on GrapesJS eventually pruning orphaned rules on next save; explicit removal would make the cleanup deterministic. Simplest path: after `selected.replaceWith(...)`, walk `editor.Css.getRules()` and `.remove()` any rule whose only selector targets a now-removed component id.

**Design notes:**

- Tailwind class-based components ride through unaffected — Tailwind CSS is served outside the project's `styles[]`. Only Style-Manager-edited rules need extraction.
- Combinator selectors (`.foo > .bar`) are tricky; for v1 it's OK to include any rule that mentions any subtree id/class anywhere in any selector (over-include slightly rather than miss).
- Worth pairing with a `Template.version: Int` column at the same time so the resolver cache can key on it — both touch the same code path.

**Estimated size:** small-to-medium. The extractor is ~30 lines; the call site changes are mechanical. Sizing depends on how strict we want selector matching.

---

## 7. Inline resolved template content in the editor canvas

**Status: shipped (2026-05-29), including styles.** `templateRefPlugin` became a factory `templateRefPlugin(templates)` that closes over the same `templates` list the editor already loads for §8. A `template-ref`'s `model.init()` looks the slug up in an in-memory map (tenant-first) and appends the resolved `data.component` as **locked, non-layerable** children inside `editor.UndoManager.skip(...)`. Cycle/runaway guard is a depth attribute (`data-tc-tpl-depth`) capped at `MAX_PREVIEW_DEPTH=8`. `model.toJSON` returns just `{ type, attributes }` so the inlined preview never reaches `page.data` (no save-path filtering needed). `onRender` shows the slug label only when there are no inlined children; placeholder chrome moved to a `:has(> .tc-template-ref__label)` CSS rule so a resolved ref is a transparent wrapper. **Styles (the deferred carry-over, now done):** each inlined template's `data.styles` (the §6 subtree slice) is injected into the **editor CSS model as protected rules** via the shared `applyTemplateStyles` helper (`lib/plugins/template-styles.ts`), and re-applied on `editor.on("load")` — exactly the pattern `designSystemPlugin` uses for the theme layer. *Why the model, not a detached `<style>`:* a first cut appended a standalone `<style>` to the canvas iframe to keep the rules out of `getProjectData()`, but that element lives outside GrapesJS' render lifecycle, so it vanished on reload / navigate-away-and-back (GrapesJS only re-renders **its own CSS model** into the canvas). Putting the rules in the model fixes that; `protected` keeps them out of saved page data (`filterProtectedStyles` / tc-local strip them), and `applyTemplateStyles`' dedupe skips any selector already present and only marks genuinely-new rules protected — so it never flips a page-owned rule to protected and loses it on save. The protected rules are stripped from storage on save and re-injected by the `load` handler on every mount, so they always reflect the current template. Serialized with the same `CssComposer` (`lib/plugins/react-renderer/project/parser.ts`) the preview/publish path uses — so the canvas matches the published render. Verified surviving navigate-away-and-back in the editor. The notes below are the original design sketch.

**What:** When a `template-ref` component is rendered on the editor canvas, fetch the referenced template's `data.pages[0].frames[0].component` and inline it as **locked** children of the placeholder, so editors see the real header/footer/pattern instead of just the slug label.

**Why:** Today's canvas behavior intentionally renders only `<span>Template <strong>{slug}</strong></span>` (see `lib/plugins/template-ref.ts`, `view.onRender`). The doc-string flags this as MVP: *"A follow-up can fetch the resolved tree and inline it as locked children for a true preview."* Without it, a converted homepage hero collapses into a one-line placeholder in the editor, even though the preview/published render shows the full content — a confusing UX discontinuity.

**Scope:**

- Inside `templateRefPlugin`, on `component:selected`/`component:mount` for a `template-ref` (or just on first render), look up the template's content. Options:
  - **Client-side resolver call.** Expose a thin `/api/templates/by-slug/<tenant>/<slug>/data` endpoint that returns `tpl.data.pages[0].frames[0].component` (and optionally styles). The plugin fetches on demand and caches by slug for the editor session.
  - **Server-render into the page record.** Resolve once when loading the page into the editor and surface the resolved tree as a sibling field on the page record. Less ergonomic — every save needs to NOT re-bake the resolved children into `page.data`.
- Mount the resolved tree as children of the `template-ref` component, with `locked: true` so users can't edit them directly. Clicking inside still bubbles to the ref (existing behavior), which exposes the "Edit template" toolbar action that already navigates to the canonical editor.
- Update the styling so the placeholder background only shows in dev / when the template can't be resolved; when content is inlined, the placeholder chrome should fade to a thin label or a border tag instead of the current full panel.

**Design notes:**

- The inlined children must not be persisted into `page.data` on save. Easiest path: mark the children with a synthetic flag (`__inlined: true` or `attributes['data-inlined']='true'`) and filter them out in `augmentedSave` (alongside the existing `filterProtectedStyles` step).
- Cache-bust on template edit. The template editor saves bump `cacheTags.template(slug)`; the editor canvas should listen for that same signal (or just refetch on focus) so editors don't see stale content after switching tabs to edit the template and back.
- Tenant context matters — globals shadow correctly only when we pass the current tenant. Lift `tenantId` from the EditorShell content (`contentTenantId`) into the plugin via an init option or event.
- Cycles / missing templates / depth-exceeded — render the same `data-template-placeholder` markers as the server resolver so the in-editor signal matches the published one.

**Estimated size:** medium. Endpoint or in-process fetcher + plugin hook + don't-save plumbing + style polish. None of the pieces are large individually; correctness across save / undo / multi-ref cases is the careful bit.

---

## 8. Register tenant templates as Block Manager entries

**Status: shipped (synced + unsynced, 2026-05-29).** `templateBlocksPlugin(templates)` (in `lib/plugins/template-blocks.ts`) is wired into `editor-shell.tsx`. Registration is unified in the exported `registerTemplateBlock(editor, tpl)` primitive: **synced** templates register `content: { type: "template-ref", attributes: { data-slug } }` (the resolver / §7 preview expand it); **unsynced** templates register `content: tpl.data.component` (the slim-shape subtree, a snapshot) and record the subtree's `styles[]` in a per-editor registry. A single lazily-installed `block:drag:stop` listener seeds those styles into `editor.Css` on drop — as **non-protected** rules so they persist into `page.data` (the dropped copy owns them now), with a selector+state+at-rule dedupe check so a re-drop or post-reload drop can't clobber the user's Style-Manager edits with the template's defaults. The convert dialog calls the same `registerTemplateBlock` after create, so a freshly-converted unsynced template is immediately draggable (and style-seeding) without a reload. **Known caveat:** dropping the same unsynced template twice on one page re-uses the snapshot's component ids, so both copies share one CSS rule — proper per-instance isolation needs id-regeneration on drop (out of scope; pairs with §13). The notes below are the original design sketch.

**What:** At editor init, call `listTemplates(tenantId)` and register each template as a GrapesJS Block via `editor.Blocks.add(...)`. Users then drag templates from the sidebar onto the canvas the same way they drag the built-in hero / column / pattern blocks.

**Why:** Today templates are *invisible from the canvas*. The only entry points are the convert-to-template dropdown (creates a new template from selection) and the URL `/admin/templates/[id]/edit`. There's no drag-from-sidebar UX. Hero-block (`lib/plugins/patterns/hero-block/hero-block.tsx`) does drag-and-drop, thumbnails, search, and category filtering for free by registering via `editor.Blocks.add` — the same primitive can surface templates. This is the single biggest "use GrapesJS the way GrapesJS wants" win on the table and unblocks the symbols-demo sidebar UX without any of its plugin overhead.

**Scope:**

- New plugin (or new init step in `editor-shell.tsx`'s `onEditor`) that runs after the editor is ready:

  ```ts
  const templates = await listTemplates(tenantId)
  for (const tpl of templates) {
    editor.Blocks.add(`tpl-${tpl.slug}`, {
      label: tpl.title,
      category: tpl.kind === "PART" ? `Parts / ${tpl.area}` : tpl.kind, // LAYOUT / PATTERN / PART
      content: tpl.synced
        ? { type: "template-ref", attributes: { "data-slug": tpl.slug } }
        : tpl.data.component, // assumes the §9 slim shape; otherwise tpl.data.pages[0].frames[0].component
      media: tpl.preview ?? defaultPreviewSvg(tpl),
      attributes: { "data-template-slug": tpl.slug },
    })
  }
  ```
- Re-register on `cacheTags.template(slug)` invalidation OR refetch when the editor regains focus, so newly-created templates appear without a full page reload.
- After `createTemplateFromSelection` returns, register the new block immediately so the user can drag a second copy without reloading.
- Pick a sensible default thumbnail. The Template row already has an optional `preview: String?` column — populate it (server-side render → screenshot, or hand-drawn SVG per kind for v1).

**Design notes:**

- For synced templates, the block's `content` is a static placeholder (just the ref). Dragging always produces the same node; the resolver does the heavy lifting at render. No re-registration needed when the template *content* changes — only when its metadata does (label, kind, area).
- For unsynced templates, the block's `content` snapshots the current template body at the moment of block registration. If a user edits the template, **existing dropped copies on pages don't change** (that's the unsynced semantic), but the BLOCK ENTRY itself goes stale. Listen for `tpl save` and re-register the block so the next drag inserts the latest body.
- Once this lands, the convert-to-template flow can stop calling `selected.replaceWith({...})` directly and instead drop the newly-created block via `editor.runCommand('block:drag-start', { block })` (or just notify the user "your template is in the sidebar"). Either way, the synced-swap and the regular drag use the same code path.
- Search and categories come from the Block Manager UI for free; no custom panel needed.
- Cross-tenant globals: include them in the same `editor.Blocks.add` loop (with category like `Global / Patterns`) so users see the shared library alongside their own templates.

**Open questions:**

- Should the block list be per-tenant-per-content-kind? E.g., when editing a Post, do we hide Layout templates? Probably yes — show only what makes sense in context.
- Where do block thumbnails come from? Manual upload, headless screenshot of the resolved tree, or a kind-default placeholder?

**Estimated size:** small to medium. The registration loop is ~30 lines; the refresh-on-change plumbing and thumbnail story are the variable bits.

---

## 9. Slim `Template.data` to `{ component, styles }`

**Status: shipped.** Migration `20260527171856_slim_template_data` reshapes legacy rows (idempotent `WHERE jsonb_typeof(data->'pages') = 'array'` guard); `saveTemplate` and `createTemplateFromSelection` write `{ component, styles }`; `resolvePageTree` reads `tplData.component` with a legacy `pages[0].frames[0].component` fallback (`TemplateBody` type in `lib/cms/templates.ts`); the template editor load path wraps back into the full project shape for GrapesJS. The notes below are the original plan.

**What:** Change the `Template.data` JSON column from a full `ProjectDefinition` (`{ pages: [{ frames: [{ component }] }], styles, ... }`) to just `{ component, styles }`. The editor still sees the full project shape — we wrap on load and unwrap on save at the IO boundary.

**Why:** Templates are conceptually a component + its styles, not "a one-page project that happens to be a template." The current shape is dead weight: `resolvePageTree` walks `data.pages?.[0]?.frames?.[0]?.component` every time, `createTemplateFromSelection` invents the wrapper to fake the editor's output shape, and any reader has to know that the `pages[0].frames[0]` layer is always a singleton. Making the stored shape match the intent removes the wrap/unwrap noise from both code paths.

**Scope:**

- Migration: write a Prisma migration that reshapes existing rows. Roughly:

  ```sql
  UPDATE templates
  SET data = jsonb_build_object(
    'component', data #> '{pages,0,frames,0,component}',
    'styles',    coalesce(data->'styles', '[]'::jsonb)
  )
  WHERE jsonb_typeof(data->'pages') = 'array';
  ```
  Idempotent guard via `WHERE` so re-running is safe.

- `saveTemplate(id, form)`: parse the editor's `ProjectDefinition` from the form (as today), then extract `{ component: project.pages[0].frames[0].component, styles: project.styles ?? [] }` before the Prisma update.
- `createTemplateFromSelection(tenantId, form)`: drop the `{ pages: [{ frames: [{ component: subtree }] }], styles }` wrapping — just store `{ component: subtree, styles }`.
- Template editor load path (`app/admin/(editor)/templates/[id]/edit/page.tsx` + the storage hydration): wrap `tpl.data` back into the project shape before handing to GrapesJS. Wherever the editor reads its initial project data from the Template row, insert:

  ```ts
  const projectData = {
    pages: [{ frames: [{ component: tpl.data.component }] }],
    styles: tpl.data.styles,
  }
  ```
- `resolvePageTree` (`lib/cms/templates.ts`): replace `tplData?.pages?.[0]?.frames?.[0]?.component` with `tplData?.component`. Also adjust the `empty:<slug>` placeholder check accordingly.
- TypeScript: introduce a `TemplateBody = { component: ComponentDefinition; styles: Rule[] }` alias and re-type `tpl.data as TemplateBody` everywhere we read it.

**Design notes:**

- Backward compatibility: the migration runs once; new writes always use the slim shape. If there's any chance of half-migrated data in dev/staging, keep the resolver tolerant of both shapes for one release: try `tplData.component` first, fall back to `tplData.pages?.[0]?.frames?.[0]?.component`.
- Pages and posts keep the full `ProjectDefinition` shape — they're genuinely multi-page-capable (or will be when multi-page lands per [[project_multi_page_support]]). Only `Template.data` slims down.
- §8 (block registration) gets simpler — `content: tpl.data.component` instead of digging through the wrapper.
- Editor IO boundary is the only place that knows about the translation. Renderers, resolver, server actions, and dialogs all see the slim shape directly.

**Estimated size:** small. One migration, four to six edits, ~30 lines of churn total. Worth doing **before** §8 since the block-registration snippet is cleaner with the slim shape.

---

## 10. Pattern categories on Templates

**What:** Add a `categories: string[]` field (or a join table) to the `Template` model so each template can declare one or more category tags ("Hero", "Footer", "Pricing", "Testimonials", …). Surface as filter chips in the block inserter, matching the WordPress.org pattern directory UX.

**Why:** Today the inserter groups blocks by `kind` only — `Layouts` / `Patterns` / `Parts`. Three top-level buckets is fine when a tenant has five templates; it stops scaling once a tenant has thirty. WP solved this with categories like Featured, About, Banners, Buttons, Columns, Contact, Footer, Gallery, Header, Hero, Images, Media, Portfolio, Posts, Query, Services, Team, Testimonials, Text — plus the ability for themes/plugins to register more via `register_block_pattern_category()`. Same problem maps cleanly to us.

**Scope:**

- Schema: add `categories String[]` to the `Template` model (Postgres array — Prisma supports this natively). Migration backfills empty arrays for existing rows.
- Convert-to-template dialog: add a multi-select for categories. Seed with a curated default list (the WP set is a reasonable starting point); allow free-text additions.
- Right-panel form (when §4 lands): same multi-select for editing categories on an existing template.
- Block-Manager registration (`lib/plugins/template-blocks.ts`): map each template's `categories` to its block entry's `category` field. GrapesJS only allows one category per block, so we'd either pick the first category, or register one block per category the template belongs to (one drag target per category — bloaty but matches WP's behavior). The cleaner approach is to keep one block entry per template and surface multi-category filtering in our own block-inserter wrapper rather than GrapesJS' native categorization.
- Admin index (when §3 lands): category filter alongside the title/kind filters.

**Design notes:**

- **Curated vs free-form**: lean curated (an enum-like list) for v1 so categories don't sprawl into "Header", "header", "Headers" variants. Allow free-form via a tenant-admin setting later if needed.
- **Tenant vs global category scoping**: globals (`tenantId IS NULL`) can declare their categories the same way tenants do; tenants can't redefine globals' categories — they only define their own templates'.
- **Indexing**: `@@index([tenantId, kind])` exists today. Add `@@index([categories])` (GIN on the array column) when filtering volume warrants it; not needed at MVP scale.
- The `kind` column doesn't go away — it stays the structural classification (Layout vs Pattern vs Part), while `categories` is the topical classification. WP keeps both: a pattern is a "pattern" structurally, and "Header" topically.

**Estimated size:** small to medium. Schema + migration + one form field + the block-inserter wiring. The UX decision about curated-vs-freeform is the unresolved bit.

---

## 11. Per-instance overrides on synced templates

**What:** Let a synced template designate specific child components as **overridable** — the rest of the template stays synced everywhere, but the marked children accept per-instance edits stored on the consuming Page. Modeled after WordPress 6.6+ "pattern overrides" / block bindings.

**Why:** Today synced templates are all-or-nothing. A "team card" template with a fixed layout but per-team name/photo can't be expressed: either every card has to show the same name (synced) or you have to copy the whole layout (unsynced, no propagation of layout changes). Overrides close this gap — most "almost identical" template use-cases pivot on a small number of per-instance fields.

**Scope:**

- **Authoring side (template editor)**: a trait or right-panel control marks a component as "overridable" with a binding name (e.g., `card-title`, `member-photo`). Stored on the component definition as e.g. `attributes['data-tc-binding']="card-title"`.
- **Consuming side (page editor)**: when the page contains a `template-ref` whose template has overridable bindings, the page stores override values keyed by binding name. Likely on the `template-ref` itself, e.g.:
  ```ts
  {
    type: "template-ref",
    attributes: {
      "data-slug": "team-card",
      "data-overrides": '{"card-title":"Alice","member-photo":"/uploads/alice.jpg"}'
    }
  }
  ```
- **Render side (`resolvePageTree`)**: when expanding a template-ref, walk the resolved subtree looking for nodes with `data-tc-binding`. For each, if the ref's `data-overrides` has a matching key, apply the override — text content for text nodes, `src`/`href` for media/links, etc. Bindable property per node type is configurable per binding kind.
- **Editor UI on consuming side**: clicking an overridable node inside the canvas's locked template-ref content (once §7 lands, inlining the resolved tree as locked children) un-locks it just enough to edit the bound property. Other nodes stay locked.

**Design notes:**

- **Binding kinds**: text (replace `content`/`textContent`), attribute (replace a named attribute like `href`, `src`, `alt`), and rich (replace child markup). WP exposes a similar surface via "block bindings" — text, image URL, link, image alt.
- **Validation**: bindings should be tied to a component type that can accept that kind of override. A text binding makes no sense on an `<img>`. The template editor's trait UI should constrain accordingly.
- **Versioning**: when a template adds a binding, existing refs in pages don't have an override for it — fine, the template's default value renders. When a template removes a binding, orphaned override entries on pages become inert — fine to leave (cheap, harmless) or strip at the next page save.
- **Naming conflicts**: binding names are template-scoped, not global. Two templates can both use `card-title` without collision; the override lookup is `(refSlug, bindingName)`.
- **Render-time cost**: another walk per expanded template-ref. Already cheap; the binding lookup is a Map check per node. Doesn't change the resolver's asymptotic cost.

**Estimated size:** medium to large. Bindings touch the template editor (authoring trait), the page editor (override editing UI), the data layer (`data-overrides` on `template-ref`), and the resolver. None of the pieces are huge individually; the correctness across edit/undo/orphan cases is the careful bit.

---

## 12. Headless thumbnail generation for `Template.preview`

**What:** Replace the hand-drawn per-kind SVG placeholders in `templateBlocksPlugin` (`lib/plugins/template-blocks.ts`) with real thumbnails generated from the template's resolved tree at a fixed viewport. Populate `Template.preview` (already in the schema) so the Block Manager shows actual previews of what users are dragging.

**Why:** Generic placeholders don't convey what the template looks like. WP solved this with the `Viewport Width` header in pattern files — the inserter renders the actual pattern markup at that width and scales it down for the thumbnail. Same approach applies once we have a render path: render the template's `data.component` (plus `data.styles`) at, say, 1400×900, screenshot to PNG/WebP, store as a URL or inline data.

**Scope:**

- New server-side renderer that takes `(tenantId, templateSlug)` → resolved tree + styles + tenant theme CSS → screenshot. Options:
  - **Headless browser (Playwright / Puppeteer)**: highest fidelity, slowest, needs a worker process. Vercel runtime supports `@sparticuz/chromium` patterns but it's heavyweight.
  - **`satori` + `@vercel/og`**: fast, runs in Vercel Functions, but renders HTML→SVG with a limited CSS subset (no `:hover`, limited flex, etc.). Often "close enough" for thumbnails; risk is real templates using unsupported CSS look broken in the thumbnail.
  - **Server-side React render to static HTML + html2canvas-style snapshot**: middle ground; usually too lossy to be worth it.
- Trigger: on `saveTemplate` success, fire a background job (Vercel Queue or similar) that regenerates the thumbnail. Store the result in object storage (Vercel Blob — already part of the marketplace stack) and persist the URL in `Template.preview`.
- Block-Manager registration: `templateBlocksPlugin` already reads `tpl.preview ?? mediaForKind(tpl.kind)`. Once thumbnails are populated, the fallback only fires for the brief window between create and first regeneration.

**Design notes:**

- **Caching**: thumbnails change only on template edit. Tie the cache to the `template:<slug>` tag we already track in `cacheTags`. URL itself can be content-addressed (hash of the template body) so CDN cache stays warm.
- **Tenant theme**: thumbnails need to inject the tenant's compiled theme CSS or the preview will look unstyled. The render call needs `tenantId` so it can pull the same theme stylesheet the preview routes use.
- **Failure mode**: if generation fails (CSS the renderer can't handle, timeout), fall back to `mediaForKind` rather than blocking the save. Surface a warning in the template editor so the user knows the thumbnail is stale.
- **Cost**: thumbnail generation is per-template-save and async. Cheap at our scale; could become a per-tenant rate-limit concern if a tenant edits a template in a tight loop. Debounce on the server side (regenerate at most once per 30s per template).
- **Aspect ratio**: WP uses 16:9 ish for the inserter; we'd pick the same and crop or letterbox templates that don't match. Storing the natural width/height alongside the URL lets the inserter offer hover-to-zoom later.

**Estimated size:** medium. The renderer choice is the gating decision; once that's picked, the pipeline (event → render → upload → URL) is mechanical.

---

## 13. Array-rooted templates (drop the multi-select wrapper)

**What:** Today the convert-to-template dialog supports multi-selection by wrapping multiple selected blocks in a synthetic `<div data-template-fragment="true">` at save time (see `components/page-builder/convert-template-dialog.tsx`). The template's stored `component` stays a single root — the resolver expands one `template-ref` into one node. Replace this with first-class array-rooted templates: store the body as `component[]` (or rename to `components`), and have the resolver splice the resolved children directly into the parent's `components[]` at the ref's position.

**Why:** The wrapper `<div>` is a real but limited blemish. For most layouts it's harmless, but it sits inside parent flex/grid containers where the original blocks were direct children — and that can break grid track placement, gap, and `:nth-child` selectors. `display: contents` mostly fixes the layout case but doesn't help with selectors and adds an accessibility footgun (the wrapper itself is ignored by AT in some browsers). The cleanest fix is no wrapper.

**Scope:**

- `Template.data` schema: allow `component: ComponentDefinition | ComponentDefinition[]`. Pairs naturally with the §9 slim-shape work that already exists.
- `resolvePageTree` / `resolveNode` (`lib/cms/templates.ts`): when expanding a `template-ref` whose template root is an array, return the array and have the parent's children mapper `.flat()` the result. Cycle/depth/missing placeholders still emit a single node.
- Convert dialog: drop the `data-template-fragment` wrapper branch — just send the array.
- Synced-replace path: unchanged — still replace the first selection with the ref and remove the rest.
- Migration: existing rows with the wrapper get a one-shot Prisma migration that unwraps `component.tagName === "div"` + `attributes["data-template-fragment"] === "true"` back into the array root.

**Design notes:**

- The renderer needs to handle the splice in any parent's `components[]`. Stays trivial as long as `resolveNode` is allowed to return `ComponentDefinition | ComponentDefinition[]`.
- If a template ref is the page root (rare), the page's `frames[0].component` becomes an array — needs a small fix in the React-renderer entry point. Same pattern.
- The wrapper does have one feature the array doesn't: a place to attach Style-Manager rules that target the fragment as a unit. In practice tenants would scope styles to inner blocks, so this is a non-loss for the convert flow; revisit if we add a UI for "edit the fragment's container styles".

**Estimated size:** small-to-medium. Schema is one line; resolver flatten is two; migration is one query; the editor side already has the array via `getSelectedAll()`.

---

## Toolbar extension reference

For when we wire the "Convert to template" button. From the grapesjs-docs RAG (`dom_components/model/types.ts`):

```ts
toolbar?: ToolbarButtonProps[]
// item: { attributes: Record<string, unknown>; command: string | ((editor) => void) }
```

Built-in command IDs:

- `core:component-exit` — select parent
- `tlb-move`, `tlb-clone`, `tlb-delete` — built-in toolbar actions

Three patterns to add items:

1. **Per-type** — set `toolbar: [...]` in `addType` `model.defaults`. Already used for `template-ref`.
2. **Iterate all types** — `editor.DomComponents.getTypes().forEach(t => editor.DomComponents.addType(t.id, ...))`. Doesn't reach `extend`-based types (see `feedback_grapesjs_extend_patch_propagation.md`).
3. **Subscribe + mutate** — `editor.on('component:selected', (cmp) => cmp.set('toolbar', [...]))`. Lightest, works on every instance regardless of `extend`. **Recommended for `tc:convert-to-template`**.

No native overflow / dropdown UI — GrapesJS renders the toolbar as a flat strip. Building the three-dots overflow menu (per the symbols-demo screenshot) is a separate React UI layer that wraps the default toolbar renderer.

---

## Deferred — overflow menu UX

**Not on the path to a complete templates story; tracking here so we don't lose it.**

The selection toolbar in the symbols-demo screenshot uses an overflow dropdown (three dots → menu items). GrapesJS doesn't ship this; it's a custom toolbar renderer somebody built. To replicate:

1. Render the GrapesJS toolbar via our own React component instead of the default DOM.
2. Read `cmp.get('toolbar')` on selection, render N primary items inline + the rest behind a "More" dropdown.
3. Keep the toolbar item registration (pattern C above) unchanged — the UI is purely about how items are presented.

Worth building only when toolbar gets crowded enough that the flat strip is awkward.

---

## Symbols decision — why we deliberately skipped `@silexlabs/grapesjs-symbols`

Captured here so a future contributor doesn't re-derive.

**The plugin solves a real problem** — in-page reuse via Symbols (4 cards on one page that stay in sync). But:

- **It doesn't cross page rows.** GrapesJS Symbols sync only within one project (`editor` instance). Our architecture is one project per `Page` row, so Symbols can't propagate across pages. Synced templates handle that case via server-side resolution.
- **Two sync mechanisms = teaching cost.** Users would need to learn when to use a Symbol vs. a Synced Template. One abstraction is cheaper than two.
- **UI mismatch.** The plugin ships its own side panel + trait styled as GrapesJS defaults. Restyling to match shadcn is more work than building the convert-to-template flow we already need.

**Revisit if:** users start hand-creating many copies of the same block on a single page and the template-create UX feels too heavy for that case. Until then, "drop the same template twice on one page" covers in-page reuse with the same primitive we already have.

Plugin source is in the RAG (`reference_grapesjs_symbols_plugin_rag.md`) for future reference.

---

## Open decisions

Captured for when we resume each task:

| Question | Pending decision |
|---|---|
| Where does the convert-to-template modal live? | shadcn Dialog in the React shell (preferred) vs. GrapesJS Modal API. Leaning shadcn for consistency. |
| Default `kind` and `synced` when converting any selection? | Leaning `kind: PATTERN, synced: false` — matches WP's default and keeps reuse-on-by-default off until the user opts in. |
| Slug rename policy when refs exist? | Forbid for MVP (option 1 in §4). Add bulk-rename later if needed. |
| Delete behavior when refs exist? | Allow delete, render placeholders. Add an inventory view later. |
| `Template.version: Int` for cache keys? | Add when we wire render-path caching. Mirror the theme system's `themeVersion` pattern. |
| Special slugs (`home` / `404` / etc.) renderer mapping? | Spec'd in `docs/templates.md`; build alongside the render-path integration. |
| Cross-tenant publish ("install this from tenant A to tenant B")? | Out of scope for MVP. Would need many-to-many or copy-on-install. |

---

## Related docs

- `docs/templates.md` — design walkthrough (data model, kinds, sync semantics, global shadowing).
- `docs/theme-document.md` — the tenant theme system that templates inherit.
- `docs/css-publish-architecture.md` — protected CssRules discipline (same `protected: true` flag matters for templates).
- `feedback_grapesjs_extend_patch_propagation.md` (in memory) — why pattern C is safer than pattern B for toolbar injection.
- `reference_grapesjs_symbols_plugin_rag.md` (in memory) — silexlabs/grapesjs-symbols source for when/if we revisit Symbols.
