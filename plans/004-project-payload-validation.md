# Plan 004: Validate project JSON payloads at the server-action boundary

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ae527df..HEAD -- lib/cms`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (an over-strict schema can break every editor save — the steps mitigate this)
- **Depends on**: plans/001-verification-baseline.md
- **Category**: security
- **Planned at**: commit `ae527df`, 2026-06-11

## Why this matters

Five server actions accept editor project JSON and store it in Postgres
`Json` columns with only `JSON.parse` + an `as object` cast — no structural
validation and no size cap. The repo already established the right pattern
for this: tenant themes are validated through a Zod schema before persisting
(`lib/cms/tenant-actions.ts:91`: `themeSchema.safeParse(theme)`). Project
payloads — which are larger, deeper, and rendered by the React renderer on
preview — get nothing. Today this is reachable by anyone (no auth — see
`plans/README.md` "Known but unplanned"); after auth lands it remains a
defense-in-depth gap: a malformed blob saved once renders broken everywhere
and is painful to repair by hand in the DB.

## Current state

The unvalidated ingestion points, all in `lib/cms/`:

1. `page-actions.ts:54-62` (`savePage`):
   ```ts
   const dataField = form.get("data")
   let data: unknown = undefined
   if (typeof dataField === "string" && dataField.length) {
     try {
       data = JSON.parse(dataField)
     } catch {
       throw new Error("Invalid project payload — could not parse JSON.")
     }
   }
   ```
   …later stored as `data: data as object` with `draftData: Prisma.DbNull`
   (`page-actions.ts:101-103`).

2. `post-actions.ts:41-49` (`savePost`) — identical pattern.

3. `template-actions.ts:85-95` (`saveTemplate`) — parses then calls
   `slimTemplateProject(project)` (which at least throws when
   `pages[0].frames[0].component` is missing — see
   `lib/cms/templates.ts:178-192`).

4. `template-actions.ts:212-237` (`createTemplateFromSelection`) — parses a
   `subtree` field (checked only as "is an object") and an optional `styles`
   field (checked only as "is an array").

5. `editor-draft-actions.ts:27-54` (`saveEditorDraft`) — receives `project:
   unknown` (not even JSON.parse — it arrives as a structured server-action
   arg) and writes `draftData: project as object` for pages/posts, or the
   slimmed shape for templates.

The shape being validated, from
`lib/plugins/react-renderer/project/types.ts:34-75` (deliberately loose —
**this looseness is a feature**; the renderer tolerates partial/older
snapshots, and components carry arbitrary extra keys):

```ts
export interface ComponentDefinition {
  id?: string
  type?: string
  tagName?: string
  attributes?: Record<string, any>
  components?: ComponentDefinition[]
  classes?: Array<string | { name: string; ... }>
  [key: string]: any
}
export interface ProjectDefinition {
  assets?: Asset[]
  styles?: Rule[]
  pages?: PageDefinition[]
  dataSources?: DataSource[]
  [key: string]: any
}
```

The exemplar to match (`lib/cms/tenant-actions.ts:87-94`):

```ts
export async function updateTenantTheme(tenantId: string, theme: Theme) {
  const parsed = themeSchema.safeParse(theme)
  if (!parsed.success) {
    throw new Error(`Invalid theme payload: ${parsed.error.message}`)
  }
  ...
}
```

Zod is already a dependency (`zod: ^4.4.3` — Zod 4 API: prefer
`z.looseObject({...})` for passthrough objects, `z.record(z.string(), ...)`
two-arg records, and `get` lazy recursion via `z.lazy`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Generate client | `pnpm prisma generate` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | all pass, incl. new schema tests |
| Format | `pnpm format` | exit 0 |

## Scope

**In scope**:
- `lib/cms/project-payload.ts` (create — schema + helpers)
- `lib/cms/project-payload.test.ts` (create)
- `lib/cms/page-actions.ts` (swap the parse block)
- `lib/cms/post-actions.ts` (swap the parse block)
- `lib/cms/template-actions.ts` (swap both parse blocks)
- `lib/cms/editor-draft-actions.ts` (validate `project` arg)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `lib/plugins/react-renderer/project/types.ts` — the TS types stay the
  contract for *reads*; do not tighten them.
- The client side (editor-shell, dialogs) — payload production is unchanged.
- Auth/tenancy checks — separate concern, not planned this run.
- `slimTemplateProject` in `lib/cms/templates.ts` — keep its existing throw.

## Git workflow

- Branch: `advisor/004-project-payload-validation`
- Commit per step; conventional style (`feat: validate project payloads in save actions`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `lib/cms/project-payload.ts`

Design constraints — read carefully:

- **Permissive by design.** GrapesJS owns this format. Validate only the
  structural skeleton; let unknown keys pass through everywhere
  (`z.looseObject`). A schema that rejects a legitimate editor payload is a
  worse bug than no schema.
- **Bound the size, not the depth-by-schema.** Add a byte cap on the raw
  string before parsing (1 MB default chosen well above observed page blobs;
  export the constant).

Shape (adapt to Zod 4 specifics as needed):

```ts
import { z } from "zod"

/** Raw-payload byte cap. Editor blobs are typically tens of KB. */
export const MAX_PROJECT_BYTES = 1_000_000

const componentSchema: z.ZodType<unknown> = z.lazy(() =>
  z.looseObject({
    type: z.string().optional(),
    tagName: z.string().optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
    components: z.array(componentSchema).optional(),
  })
)

const frameSchema = z.looseObject({ component: componentSchema.optional() })
const pageSchema = z.looseObject({ frames: z.array(frameSchema).optional() })

export const projectDefinitionSchema = z.looseObject({
  pages: z.array(pageSchema).optional(),
  styles: z.array(z.looseObject({})).optional(),
  assets: z.array(z.looseObject({})).optional(),
})

/** Parse + validate a project payload posted as a JSON string. Throws with
 *  a user-surfaceable message on any failure. */
export function parseProjectPayload(raw: string): object { ... }

/** Validate an already-structured payload (server-action arg). */
export function validateProjectPayload(value: unknown): object { ... }

/** Validate a single component subtree (convert-to-template flow). */
export function validateComponentPayload(value: unknown): object { ... }
```

Error messages must match the existing tone:
`"Invalid project payload — could not parse JSON."` (keep verbatim for the
parse failure so existing behavior is preserved), plus new
`"Project payload too large."` and `"Invalid project payload: <zod message>."`.

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Write the tests FIRST against real fixtures

`lib/cms/project-payload.test.ts` (model after the plan-001 test files):

- A realistic minimal project passes:
  `{ pages: [{ frames: [{ component: { tagName: "div", components: [] } }] }], styles: [] }`.
- A project with arbitrary extra keys at every level passes (passthrough).
- `{}` passes (the renderer tolerates empty projects; `Page.data` defaults
  to `{}` in the schema).
- A 5-level nested component tree passes.
- `pages: "nope"` fails; `styles: 42` fails; raw `"not json"` fails with the
  verbatim legacy message; a string > `MAX_PROJECT_BYTES` fails fast.
- `validateComponentPayload` accepts a bare component, rejects arrays/null.

**Verify**: `pnpm test` → new file passes.

### Step 3: Wire into the four action files

In each location from "Current state", replace the bare
`JSON.parse`/object-check with the matching helper:

- `savePage` / `savePost`: `data = parseProjectPayload(dataField)`.
- `saveTemplate`: `project = parseProjectPayload(dataField)` then the
  existing `slimTemplateProject(project)` unchanged.
- `createTemplateFromSelection`: `subtree = validateComponentPayload(JSON.parse(subtreeField))`
  — or refactor to a `parseComponentPayload(raw)` helper; keep the existing
  distinct error messages for missing/empty fields. For `styles`, keep the
  current lenient handling (array-or-ignore) but route through the schema's
  styles validation if trivial.
- `saveEditorDraft`: `const validated = validateProjectPayload(project)`
  before the switch; pass `validated` onward. Keep the function's existing
  doc comment intact and append one line noting validation.

**Verify after each file**: `pnpm typecheck && pnpm lint` → exit 0.

### Step 4: Behavioral regression sweep

- `pnpm test` → all plan-001 suites still pass (especially
  `templates.test.ts`, since `saveTemplate`'s flow feeds
  `slimTemplateProject`).
- Manual smoke note for the operator (include in your report): open the
  editor on a page, edit, Save draft, Publish — both must succeed; open a
  template, save — must succeed. If any legit save fails validation, that is
  a STOP condition, not a schema-tightening opportunity in reverse: loosen
  the schema to admit the payload, add the payload shape as a passing test
  fixture, and note it.

## Test plan

See Step 2. New file `lib/cms/project-payload.test.ts`, modeled structurally
after `lib/cms/style-extract.test.ts` (from plan 001). Cases listed in Step 2;
all must pass via `pnpm test`.

## Done criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `grep -rn "JSON.parse" lib/cms/page-actions.ts lib/cms/post-actions.ts lib/cms/editor-draft-actions.ts` → no direct unvalidated parse of project payloads remains (parses live in `project-payload.ts`)
- [ ] `grep -n "as object" lib/cms/editor-draft-actions.ts` → casts operate on validated values only
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A real editor payload (from the smoke check or a `Page.data` row) fails
  the schema and you cannot loosen the schema to admit it without making the
  validation vacuous — report the payload shape.
- Zod 4's API diverges from the sketch in ways that force a different
  recursion pattern and you're unsure of equivalence.
- The action files' parse blocks no longer match the excerpts (drift).
- You find yourself wanting to add tenancy/auth checks here — out of scope.

## Maintenance notes

- When GrapesJS is upgraded (see index notes on dep currency), new
  top-level project keys may appear — the loose schema admits them by
  design; only structural breaks need schema updates.
- `MAX_PROJECT_BYTES` may need raising for image-heavy `assets` arrays;
  it's exported and tested for exactly that reason.
- Plan 008 (`layoutSlug`) touches `savePage` nearby — coordinate merges.
- Reviewer should scrutinize: that error messages surfaced to the editor UI
  remain user-readable (the editor shows action errors in toasts).
