# Plan 008: LAYOUT content slot + page→layout assignment (§14)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Required reading before step 1**: `docs/reference/templates-followups.md` §14
> (the maintainer's own resolved design — this plan operationalizes it; on
> any conflict between that doc and this plan, STOP and report the conflict),
> plus `docs/reference/templates.md` for the template model background.
>
> **Drift check (run first)**: `git diff --stat ae527df..HEAD -- prisma/schema.prisma lib/cms lib/plugins "app/preview" components/page-builder "app/admin/(editor)/pages"`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2 (direction — maintainer-selected)
- **Effort**: M
- **Risk**: MED (touches the resolver and a schema migration; mitigated by being non-breaking by construction — `layoutSlug = null` renders byte-identical to today)
- **Depends on**: plans/001-verification-baseline.md (resolver characterization tests MUST exist and pass before touching `templates.ts`)
- **Category**: direction
- **Planned at**: commit `ae527df`, 2026-06-11

## Why this matters

Today every `Page.data` is the entire top-to-bottom document — header,
content, footer baked into one blob; templates only reach a page by being
pulled in via `template-ref` nodes *inside* that blob. WordPress inverts
this: a template reserves a hole and the page's content pours into it.
Without that inversion, `TemplateKind.LAYOUT` is mechanically identical to
`PATTERN`. The maintainer's design doc calls this "the single thing that
makes LAYOUT mean what 'template' means in WP" and resolved the design on
2026-06-09 (`docs/reference/templates-followups.md` §14): explicit per-page assignment
(WP custom-template model), one slot, non-breaking for unassigned pages.

## Current state

### Data model — `prisma/schema.prisma`, `Page` model (excerpt)

```prisma
model Page {
  id          String        @id @default(cuid())
  slug        String
  path        String
  parentId    String?
  ...
  data        Json          @default("{}")
  draftData   Json?
  status      ContentStatus @default(DRAFT)
  ...
  @@unique([tenantId, path])
  @@unique([parentId, slug])
}
```

No `layoutSlug` column exists.

### Resolver — `lib/cms/templates.ts`

- `const TEMPLATE_REF_TYPE = "template-ref"`, `const SLUG_ATTR = "data-slug"`,
  `const MAX_DEPTH = 16` (lines 139-147).
- `type ResolveCtx = { tenantId, cache: Map<string, Template | null>, visiting: Set<string>, styles: Rule[], stylesAdded: Set<string> }` (lines 194-200).
- `resolvePageTree(tenantId, data)` (lines 222-256): unwraps
  `data.pages[0].frames[0].component`, calls `resolveNode(ctx, root, 0)`,
  returns the input unchanged when nothing resolved, else rebuilds the
  project with the resolved root and `styles: [...(data.styles ?? []), ...ctx.styles]`.
- `resolveNode(ctx, node, depth)` (lines 258-311): depth guard → template-ref
  branch (slug → `loadTemplate` via `ctx.cache` → slim/legacy body →
  `unwrapTemplateRoot` → recursive resolve with `ctx.visiting` cycle guard →
  per-slug style dedupe via `ctx.stylesAdded`) → otherwise recurse into
  `node.components` via `Promise.all`.
- `placeholder(reason)` (lines 319-325): returns
  `{ tagName: "div", attributes: { "data-template-placeholder": reason }, components: [] }`.
- `loadTemplate(tenantId, slug)` (lines 89-99): tenant-first/global-fallback
  single query.
- `templateRefExists(slug)` (lines 116-135): one raw SQL probe with three
  `jsonb_path_exists` EXISTS clauses over `pages`/`posts`/`templates`.

### Render call site — `app/preview/[tenantId]/[...slug]/page.tsx:37-45`

```tsx
const page = await prisma.page.findUnique({
  where: { tenantId_path: { tenantId, path } },
})
if (!page) notFound()

const projectData = await resolvePageTree(
  tenantId,
  page.data as ProjectDefinition
)
```

### Editor plugin wiring — `components/page-builder/editor-shell.tsx`

- Plugins array lives in `buildGjsOptions` (~line 345):
  `tcStorage..., designSystemPlugin, ..., templateRefPlugin(templates), templateBlocksPlugin(templates), ...`
- `buildGjsOptions(initialProjectData, debouncedPersist, templates)` is
  called from a `React.useMemo` (~line 637) with deps
  `[initialProjectData, debouncedPersist, templates]`.
- The exemplar plugin to clone for the slot:
  `lib/plugins/template-ref.ts` — registers a component type via
  `editor.Components.addType`, locked placeholder chrome via protected CSS,
  exports its type constants (`TEMPLATE_REF_TYPE = "template-ref"`,
  marker attrs). Read it fully before writing the slot plugin.

### Save action — `lib/cms/page-actions.ts` `savePage(id, form)` (lines 41-110)

Reads metadata fields with `existing`-fallbacks, validates slug/path rules,
updates the row, bumps cache tags. (If plan 004 landed first, the `data`
parse goes through `parseProjectPayload` — integrate around it.)

### Right panel — `components/page-builder/right-panel/right-panel.tsx`

`PageOnlyFields({ content, isPublished })` (lines 227-258) renders the
Parent `Select` with `name="parentId"`, options from `content.parentOptions`.
`PageContent` type lives in `components/page-builder/types.ts:45`. The page
edit route (`app/admin/(editor)/pages/[id]/edit/page.tsx`) builds `content =
{ kind: "page", page, parentOptions }` and already fetches
`listTemplates(page.tenantId)` into a `templates` prop.

### Reads available

`listTemplatesByKind(tenantId, kind)` exists (`lib/cms/templates.ts:71-79`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Migration | `pnpm prisma migrate dev --name add_page_layout_slug` | exit 0, new folder in `prisma/migrations/` |
| Generate client | `pnpm prisma generate` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | all pass incl. new resolver cases |
| Format | `pnpm format` | exit 0 |

`pnpm prisma migrate dev` needs a local `DATABASE_URL` (the developer's
`.env`). If no local DB is reachable, create the migration with
`pnpm prisma migrate dev --create-only` and STOP-report that it's unapplied.

## Scope

**In scope**:
- `prisma/schema.prisma` (one column) + the generated migration
- `lib/cms/templates.ts` (slot branch, `resolvePageWithLayout`, `templateRefExists` extension)
- `lib/cms/templates.test.ts` (extend plan-001 suite)
- `lib/plugins/content-slot.ts` (create)
- `components/page-builder/editor-shell.tsx` (wire the plugin; pass a gate flag)
- `app/preview/[tenantId]/[...slug]/page.tsx` (call-site swap)
- `lib/cms/page-actions.ts` (`savePage` reads `layoutSlug`)
- `components/page-builder/types.ts` (PageContent gains `layoutOptions`)
- `components/page-builder/right-panel/right-panel.tsx` (Layout select)
- `app/admin/(editor)/pages/[id]/edit/page.tsx` (pass layout options)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though related):
- `app/preview/[tenantId]/blog/**` — posts do NOT get layout assignment in
  this plan (open question in §14; decided separately).
- Editor inline preview of the surrounding layout chrome (§14 explicitly
  defers it — the canvas keeps showing only the page fragment).
- Resolver render-caching / `Template.version` (§14 design notes defer it).
- Multiple named slots — one slot, per the resolved design.
- `lib/plugins/template-ref.ts` itself — clone its patterns, don't modify it.

## Git workflow

- Branch: `advisor/008-layout-content-slot`
- Commit per step (`feat: add Page.layoutSlug`, `feat: content-slot resolver
  branch + resolvePageWithLayout`, `feat: content-slot editor plugin`, …).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Schema — `Page.layoutSlug String?`

Add to the `Page` model, after `parentId`/`parent`/`children` block (keep
the model's comment style — explain *why slug not FK*):

```prisma
  // Optional LAYOUT assignment (docs/reference/templates-followups.md §14). Stored
  // as a slug (not an FK) to inherit the tenant-first/global-fallback
  // shadowing `loadTemplate` gives every other template reference.
  // null = self-contained page (data is the whole document, today's
  // behavior); non-null = data is a fragment spliced into the layout's
  // content-slot at render.
  layoutSlug  String?
```

Run the migration + generate.

**Verify**: `pnpm prisma migrate dev --name add_page_layout_slug` exit 0;
`grep -n "layoutSlug" prisma/migrations/*add_page_layout_slug/migration.sql`
→ one `ALTER TABLE "pages" ADD COLUMN`; `pnpm typecheck` exit 0.

### Step 2: Resolver — slot branch + composer (test-first)

**2a. Extend the plan-001 resolver tests first** with the new cases (they
will fail until 2b):

1. `resolvePageWithLayout` with `layoutSlug: null` returns exactly what
   `resolvePageTree` returns (same reference when unresolved — the
   non-breaking guarantee).
2. Layout `"shell"` = `{ component: { tagName: "div", components: [header-ref, { type: "content-slot" }, footer-ref] } }`
   → resolved tree has the page's resolved root where the slot was, and the
   header/footer PART contents expanded.
3. Missing layout slug → page renders bare (the resolvePageTree result),
   no throw.
4. Layout **without** a slot → page content dropped; result contains no
   page content (and, matching §14's note, nothing crashes).
5. A slot encountered with no `ctx.slot` set (a stray `content-slot` inside
   a normal page resolve) → `placeholder("empty-slot")`.
6. Style merge order: page styles, then page-template styles, then layout
   styles, then layout-part styles (assert relative order in the final
   `styles[]`).

**2b. Implement in `lib/cms/templates.ts`:**

- Constant near the existing ones: `const CONTENT_SLOT_TYPE = "content-slot"`
  — export it (the plugin and tests import it).
- `ResolveCtx` gains `slot?: ComponentDefinition`.
- In `resolveNode`, BEFORE the `template-ref` branch:

  ```ts
  if (node.type === CONTENT_SLOT_TYPE) {
    return ctx.slot ?? placeholder("empty-slot")
  }
  ```

- New exported composer (≈25 lines), following the §14 design verbatim:

  ```ts
  export async function resolvePageWithLayout(
    tenantId: string,
    page: { data: ProjectDefinition; layoutSlug: string | null }
  ): Promise<ProjectDefinition>
  ```

  1. `const resolvedPage = await resolvePageTree(tenantId, page.data)`
  2. `if (!page.layoutSlug) return resolvedPage`
  3. `loadTemplate(tenantId, page.layoutSlug)`; if missing/empty body →
     return `resolvedPage` (graceful bail).
  4. Build a ctx whose `slot` is the resolved page's root component
     (`resolvedPage.pages[0].frames[0].component`; if absent, return
     `resolvedPage`), resolve the layout's root
     (slim/legacy body read + `unwrapTemplateRoot`, same as the ref branch —
     factor a small shared helper if it stays readable).
  5. Return a project shaped like `resolvedPage` but with the layout's
     resolved root as the frame component and styles merged in the §14
     cascade order: `[...(resolvedPage.styles ?? []), ...layoutStyles, ...ctx.styles]`
     where `layoutStyles` is the layout's own `data.styles` and `ctx.styles`
     are the styles collected while resolving the layout's internal refs.
     The slot content is already resolved — it is spliced as-is, never
     re-resolved.

  Note on the cycle surface: the layout resolve uses a fresh ctx (fresh
  `visiting`), which is safe — the slot content is pre-resolved data and the
  layout's own refs get the normal guards.

**Verify**: `pnpm test` → all cases from 2a pass; pre-existing resolver
tests untouched and green.

### Step 3: `templateRefExists` covers layout assignments

Per the §14 addendum: extend the raw query in `templateRefExists`
(`lib/cms/templates.ts:118-133`) with a fourth clause:

```sql
OR EXISTS (SELECT 1 FROM "pages" WHERE "layoutSlug" = ${slug})
```

(plain text param — NOT the jsonb `vars`). Update the function's doc comment.

**Verify**: `pnpm typecheck` exit 0. If plan-001's suite mocks
`$queryRaw`, extend the mock; otherwise note that this clause is verified by
the rename-guard manual check in Step 7.

### Step 4: Content-slot editor plugin

Create `lib/plugins/content-slot.ts`, cloned structurally from
`lib/plugins/template-ref.ts` (read it first — match its doc-comment style,
its `addType` usage, and its protected-CSS placeholder chrome approach):

- Export `CONTENT_SLOT_TYPE = "content-slot"` — import from
  `@/lib/cms/templates`? **No**: `templates.ts` imports `prisma`; a client
  plugin must not. Mirror the `template-shape.ts` precedent: define the
  constant in the plugin file and have `lib/cms/templates.ts` define its own
  copy (or move the constant into `lib/cms/template-shape.ts`, which both
  sides already import — preferred; do that).
- `contentSlotPlugin(opts: { enableBlock: boolean })` factory:
  - `editor.Components.addType("content-slot", ...)`: `model.defaults` with
    `tagName: "div"`, a marker attribute (e.g. `data-content-slot`),
    `removable: false` is wrong for authoring (the author must be able to
    delete/re-place it) — make it `draggable: true, droppable: false,
    editable: false, layerable: true`, label "Page content". Locked
    placeholder chrome via a protected CSS rule (follow
    `PLACEHOLDER_CSS` + `applyTemplateStyles`-style injection in
    template-ref.ts; a simple dashed box labeled "Page content").
  - When `opts.enableBlock`: `editor.Blocks.add("content-slot", { label:
    "Page content", category: "Layout", content: { type: "content-slot" },
    media: <simple inline SVG> })`.
  - **One-slot rule**: on `block:drag:stop` (or `component:add`), if a
    second `content-slot` appears in the tree, remove the new one and emit a
    GrapesJS notice — keep it ~10 lines; if it balloons, ship without the
    guard and note it (render behavior with two slots: both get the same
    content — acceptable interim).

**Verify**: `pnpm typecheck && pnpm lint` exit 0.

### Step 5: Wire the plugin in the editor shell

In `components/page-builder/editor-shell.tsx`:

- `buildGjsOptions` gains a parameter for the gate (e.g.
  `contentKind: { isLayoutTemplate: boolean }` or just `enableSlotBlock:
  boolean`), threaded from the component: the editor edits a LAYOUT when
  `content.kind === "template" && content.template.kind === "LAYOUT"`
  (check the exact `TemplateContent` shape in
  `components/page-builder/types.ts` before writing this).
- Add `contentSlotPlugin({ enableBlock })` to the plugins array AFTER
  `designSystemPlugin` (same ordering rationale as templateRefPlugin — read
  the comments at lines ~345-376 and keep their style).
- The type must register for ALL content kinds (a page being edited may
  carry nothing, but a LAYOUT template's saved tree contains the slot and
  must render in any canvas); only the Block is gated.
- Update the `React.useMemo` deps for the new argument.

**Verify**: `pnpm typecheck && pnpm lint` exit 0.

### Step 6: savePage reads layoutSlug + preview call-site swap

**6a. `lib/cms/page-actions.ts` `savePage`:**

```ts
// Layout assignment (§14). Absent field = preserve; empty string = clear.
const layoutField = form.get("layoutSlug")
let layoutSlug = existing.layoutSlug
if (typeof layoutField === "string") {
  layoutSlug = layoutField.trim() === "" ? null : layoutField.trim()
}
if (layoutSlug && layoutSlug !== existing.layoutSlug) {
  const layout = await loadTemplate(existing.tenantId, layoutSlug)
  if (!layout || layout.kind !== "LAYOUT") {
    throw new Error(`Layout "${layoutSlug}" not found.`)
  }
}
```

…and include `layoutSlug` in the `prisma.page.update` data. Import
`loadTemplate` from `./templates`. Bump `updateTag(cacheTags.page(existing.path))`
already happens — sufficient.

**6b. Preview call site** — `app/preview/[tenantId]/[...slug]/page.tsx`:

```tsx
const projectData = await resolvePageWithLayout(tenantId, {
  data: page.data as ProjectDefinition,
  layoutSlug: page.layoutSlug,
})
```

(The `findUnique` has no `select`, so `layoutSlug` is already on the row
after `pnpm prisma generate`.)

**Verify**: `pnpm typecheck && pnpm test` exit 0.

### Step 7: Layout select in the page right panel

- `components/page-builder/types.ts`: `PageContent` gains
  `layoutOptions: Array<{ slug: string; title: string }>`.
- `app/admin/(editor)/pages/[id]/edit/page.tsx`: build it from the already
  fetched `templates` list:
  `templates.filter((t) => t.kind === "LAYOUT").map(({ slug, title }) => ({ slug, title }))`
  and add it to the `content` object.
- `right-panel.tsx` `PageOnlyFields`: below the Parent select, add a
  "Layout" `Select` with `name="layoutSlug"`,
  `defaultValue={content.page.layoutSlug ?? ""}`, first item
  `<SelectItem value="">— None (self-contained) —</SelectItem>`, then one
  item per option (`value={opt.slug}`). Match the Parent select's markup
  and sizing exactly. Note: `content.page` is the Prisma `Page` row — after
  Step 1 it carries `layoutSlug`; if the `PageContent` type pins an explicit
  page shape, extend it.

**Verify**: `pnpm typecheck && pnpm lint` exit 0. Manual smoke note for the
operator (include in your report): create a LAYOUT template with header +
"Page content" block + footer; assign it to a page via the new select; Save;
open `/api/preview?tenantId=…&path=/…` — the preview must show
header + page content + footer; un-assign → page renders bare again.

### Step 8: Documentation sync

Update `docs/reference/templates-followups.md` §14's status line from
"**Status: planned (2026-06-09)**" to shipped-with-date plus a one-line
deviation list (if any). This file is the repo's living tracker — match how
§3-§9 record their shipped states.

**Verify**: `grep -n "Status:" docs/reference/templates-followups.md | head` shows the
§14 line updated.

## Test plan

Extend `lib/cms/templates.test.ts` (plan 001) with the six cases in Step 2a,
modeled on the existing resolver fixtures (`project()` / `ref()` helpers).
Verification: `pnpm test` → all pass, including all pre-existing
characterization cases **unchanged** — if an existing test needs editing,
that's a behavior change: STOP.

## Done criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` all exit 0
- [ ] Migration exists and applies (`pnpm prisma migrate dev` clean)
- [ ] `grep -n "content-slot" lib/cms/templates.ts lib/plugins/content-slot.ts lib/cms/template-shape.ts` → type constant single-sourced as decided in Step 4
- [ ] `app/preview/[tenantId]/[...slug]/page.tsx` calls `resolvePageWithLayout` (grep)
- [ ] A page with `layoutSlug = null` produces a byte-identical resolver result (test case 1 green)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated; §14 status updated in `docs/reference/templates-followups.md`

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 001's resolver tests don't exist or don't pass at your starting
  commit — the dependency is hard.
- The §14 section of `docs/reference/templates-followups.md` has changed since
  2026-06-09 in a way that conflicts with this plan (the doc wins; report).
- `buildGjsOptions` / the plugins array has been restructured beyond
  recognition (editor-shell is the repo's highest-churn file).
- The one-slot guard or the plugin's locked-chrome approach requires
  modifying `template-ref.ts` or `designSystemPlugin`.
- `pnpm prisma migrate dev` cannot reach a local database (use
  `--create-only` and report).
- Any pre-existing resolver test needs modification to stay green.

## Maintenance notes

- **Posts**: §14 leaves post layouts as an open question (leaning: fixed
  tenant-configured post layout). The composer takes `{ data, layoutSlug }`,
  so posts can adopt it without resolver changes.
- **Template hierarchy later**: computing `layoutSlug` from route shape
  instead of the column reuses everything here (§14 design fork note).
- **Render caching**: when resolver caching lands, the cache key must
  include `layoutSlug` + the layout's version — see §14 design notes and
  `cacheTags.template`.
- **Rename guard**: Step 3 makes layout assignments block template slug
  renames via `templateRefExists` — reviewer should verify the new SQL
  clause uses a text param, not the jsonb vars.
- Reviewer should scrutinize: style merge order (test case 6) and that the
  slot branch sits BEFORE the template-ref branch in `resolveNode`.
