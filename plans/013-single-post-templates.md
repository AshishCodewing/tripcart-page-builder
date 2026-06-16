# Plan 013: User-authored single-post templates (content-slot + dynamic fields)

> **Status: NOT STARTED (design approved 2026-06-16).** Depends on Pieces 1–2
> of the multi-header chrome work (shipped) for the reserved-slug + segment
> patterns it reuses. Effort: L. This is the "Option C" path — the full
> content-slot + dynamic-binding capability previously deferred, now planned.

## Context

A single post renders inside a **hardcoded React `<article>`** in
`app/preview/[tenantId]/posts/[slug]/page.tsx` — title above the body, date
below the title, no featured image, no way for a user to change the
arrangement. The goal: let users **author a single-post template on the
GrapesJS canvas** from dynamic field blocks (Post Title, Post Featured Image,
Post Date) plus a Content slot (the post body), arranged freely (e.g. featured
image above OR below the title). At render each dynamic block binds to the
current post and the body pours into the content slot.

This is distinct from the chrome work (header/footer): chrome wraps every page
uniformly; this arranges the *post's own fields* around the *post body*.

**Key architectural finding:** the React renderer
(`lib/plugins/react-renderer/project/render-component.tsx`) has **no
data-context mechanism** — it maps `node.type → config.components[type]` and
falls back to `node.tagName`. So binding post data is cleanest as a
**server-side tree transform** (same philosophy as the existing
`resolvePageTree`), requiring **zero renderer changes**.

**Decisions (confirmed with user 2026-06-16):**
- v1 dynamic fields: **Post Title, Post Featured Image, Post Date** + the
  **Content slot**. Excerpt / taxonomy / author deferred.
- Assignment: **tenant-level reserved `single` LAYOUT slug**, resolved
  tenant-first → global → code default. No per-post override in v1 (layer on
  later via `Post.layoutSlug`).

## Approach

The single-post template is a `kind: LAYOUT` template at the **reserved slug
`single`** (WP's template-hierarchy name), authored on the canvas from four
locked dynamic blocks. At render, a **pure server-side transform** binds each
dynamic node to the current post and pours the resolved post body into the
content slot, then hands the result to the existing `PagePreview`. If no
`single` template exists, the route falls back to today's hardcoded article
(non-breaking).

Why server-side transform (not React context or `children`-threading): it
handles all four node types uniformly, addresses arbitrarily-nested nodes,
preserves author ids/classes (cascade intact), runs entirely before the
renderer, and needs no renderer changes. Context/children-threading can only
deliver one injected value and can't address a deep slot or set per-node field
values — they collapse back into needing a transform anyway.

**Render-correctness rules (load-bearing):**
- `post-title` / `post-date` bound by setting `content` + `components: []`, and
  rendered via their **raw `tagName`** (author's chosen `h1`/`time`). They are
  **NOT** registered in `patternComponents` — that would override `tagName` and
  lose heading semantics. Canvas placeholders use the `template-ref`-style
  `view.onRender`, not `patternComponents`.
- `content-slot` keeps its own element (`tagName`, default `div`) + id/class so
  the author can style the content column; binding sets its `components` to the
  resolved post-body root's children. First slot in document order wins;
  extra slots stay empty; if none, append the body at the layout root (+ dev
  warning) so content is never lost.
- `post-featured-image` binds `attributes.src`; when `post.featuredImage` is
  null the node is **filtered out** of its parent's children (no broken `<img>`).
- Nested `template-ref`s in the layout are already expanded by
  `resolvePageTree` *before* binding, so the transform only sees concrete nodes
  + the four dynamic types.

## Phase 1 — Data + binding + render (no editor UI)

Provable by seeding a `single` LAYOUT row in the DB; no editor changes → zero
risk to existing editing.

1. **Prisma**: add `featuredImage String?` to `Post`, migrate
   (`add_post_featured_image`), regenerate client.
2. **New `lib/cms/post-template.ts`:**
   - `POST_FIELD_TYPES = { title:"post-title", featuredImage:"post-featured-image", date:"post-date", contentSlot:"content-slot" }`.
   - `bindPostTemplate(layoutRoot, post, bodyChildren): ComponentDefinition` —
     pure recursive structural-sharing walk (closure flag for first-slot-wins;
     filter null featured image; preserve attributes/classes/ids).
   - `formatPostDate(publishedAt): string`.
   - `resolveSinglePostRender(tenantId, post): Promise<{kind:"layout", projectData} | {kind:"default"}>` —
     `loadTemplate(tenantId,"single")`; if found: wrap slim body into a project
     via `unwrapTemplateRoot` (mirror `resolveChromeBySlug`), `resolvePageTree`
     it (expands refs + layout styles), `resolvePageTree(post.data)` for body,
     extract body root children, `bindPostTemplate`, merge styles (layout then
     body), return `{kind:"layout"}`. Else `{kind:"default"}`.
3. **Modify `app/preview/[tenantId]/posts/[slug]/page.tsx`:** call
   `resolveSinglePostRender`; `"layout"` → `<PagePreview … rootTag="article" />`;
   `"default"` → keep the existing hardcoded `<article>` verbatim.
4. **Follow-up:** the public/published render path must call
   `resolveSinglePostRender` too — wire or note as fast-follow.

**Verify:** unit-test `bindPostTemplate` (binding, first-slot, multi-slot,
no-slot append, null image filtered, id/class preserved). Seed a `single`
LAYOUT row by hand; set a post's `featuredImage`; preview → fields bind, body
pours in. Delete row → fallback article.

## Phase 2 — Editor authoring

1. **New `lib/plugins/post-fields.ts`:** `postFieldsPlugin({ enabled })`. Clone
   the locked-component pattern from `lib/plugins/template-ref.ts`: **always**
   `addType` the four types (`editable:false`, `draggable:true`,
   `stylable:true`, `droppable:false`, `toJSON → {type, attributes, tagName}`
   only); **only when `enabled`** register four `Blocks.add` entries in a
   `"Post fields"` category. Canvas placeholders via `view.onRender` + protected
   CSS.
2. **Gate by kind** in `components/page-builder/editor-shell.tsx`:
   `allowPostFields = content.kind === "template" && content.template.kind === "LAYOUT"`;
   thread into `buildGjsOptions(..., { allowPostFields })`; add to `useMemo`
   deps.
3. **Generalize reserved-slug guard** (`lib/cms/templates.ts` /
   `template-actions.ts`): `RESERVED_SLUG_KINDS = { header:"PART", footer:"PART", single:"LAYOUT" }`
   + `assertReservedSlug(slug, kind)`. Update create/rename call sites.
4. **(Optional) Seed a global default `single` LAYOUT** built from the four
   nodes; then the hardcoded fallback can be removed.

**Verify:** Post-field blocks appear only for LAYOUT editing; reorder
image/title, style the slot, save → `Template.data` has only
`{type,attributes,tagName}` nodes; preview binds live; page editor unaffected.

## Phase 3 — Assignment surface / per-post (later)

- Library affordance to create/edit the reserved `single` LAYOUT; guard against
  renaming away from `single`.
- Per-post override: `Post.layoutSlug String?` + `resolveSinglePostRender`
  prefers `post.layoutSlug ?? "single"` + a right-panel picker.

## Critical files

- `lib/cms/templates.ts` — `loadTemplate`, `resolvePageTree`,
  `unwrapTemplateRoot`, reserved-slug guard.
- `app/preview/[tenantId]/posts/[slug]/page.tsx` — render path rewritten.
- `lib/plugins/template-ref.ts` — locked-component / `toJSON` / `onRender`
  pattern to clone.
- `components/page-builder/editor-shell.tsx` — `buildGjsOptions` + plugins
  (`allowPostFields` gating).
- `lib/plugins/react-renderer/project/render-component.tsx` — renderer contract
  dictating the raw-tag rule for title/date.
- New: `lib/cms/post-template.ts`, `lib/plugins/post-fields.ts`.

## Risks / edge cases

- **Heading-tag trap:** keep post-title/date as raw tags (not in
  `patternComponents`) or heading semantics are lost.
- **Reserved `single` rename/delete** silently reverts posts to default —
  needs an explicit guard (the `templateRefUsage` guard won't catch
  slug-resolved usage).
- **Public render path** must mirror the preview change.
- **Style cascade:** layout styles then body styles; body wins ties (document).
- **content-slot not droppable in v1** (static placeholder).
