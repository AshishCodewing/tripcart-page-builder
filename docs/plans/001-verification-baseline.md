# Plan 001: Establish a verification baseline — Vitest + characterization tests for the CMS core

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ae527df..HEAD -- lib/cms lib/theme package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `ae527df`, 2026-06-11

## Why this matters

This repo has **zero tests and no test runner** — the only verification is
`pnpm typecheck` + `pnpm lint`. Meanwhile the most correctness-critical code
is pure-ish logic with high churn: the recursive template resolver
(`resolvePageTree` — cycle guards, depth limits, style dedupe), the CSS
subtree extractor (`style-extract.ts` — selector matching across three
serialized shapes), page-path building, and the template root unwrapper.
Several other planned changes (plans 004, 005, 008) modify exactly these
modules; without characterization tests first, those changes are unguarded.
This plan adds Vitest and characterization tests for the highest-risk pure
modules. It deliberately does NOT aim for coverage breadth — it pins down
current behavior of the dangerous code.

## Current state

- **No test files exist** anywhere (`git ls-files | grep -c test` → 0). No
  vitest/jest in `package.json`. `CLAUDE.md` says "There is no test runner
  configured yet."
- `package.json` scripts today (excerpt):
  ```json
  "lint": "eslint",
  "format": "prettier --write \"**/*.{ts,tsx}\"",
  "typecheck": "tsc --noEmit",
  ```
- `package.json` has `"type": "module"`. Path alias `@/*` → repo root
  (`tsconfig.json` `paths: { "@/*": ["./*"] }`).
- Prisma client is generated into `generated/prisma/` (git-ignored) — run
  `pnpm prisma generate` once before typechecking/testing if the directory
  is missing.

### Modules under test

1. **`lib/cms/template-shape.ts`** — pure, no runtime imports. Exports
   `unwrapTemplateRoot(root: ComponentDefinition): ComponentDefinition`.
   Behavior: returns the input unchanged unless the root is "document-level"
   (`type === "wrapper"`, or `tagName` lowercased ∈ {body, html, head}), in
   which case it returns
   `{ tagName: "div", attributes: { ...root.attributes, "data-tc-template-root": "true" }, components: root.components ?? [] }`.

2. **`lib/cms/style-extract.ts`** — pure. Exports:
   - `collectComponentIdentity(node, acc?)` — recursively collects ids (from
     `node.id` and `node.attributes.id`) and classes (from `node.classes[]`
     entries that are strings or `{ name }` objects, plus space-separated
     `node.attributes.class`).
   - `extractStylesForSubtree(allStyles, subtree)` — filters rules whose
     `selectors[]` match (string selectors: `#x` → id, `.x` → class, bare →
     class; object selectors: `{ name, type }` with `type === 2` meaning id)
     or whose `selectorsAdd` raw string mentions `#id`/`.class` tokens.
     Returns `[]` when the subtree has no ids/classes.
   - `collectStyledIds(styles)` — set of id names targeted by rules.
   - `remapStyleIds(styles, idMap)` — returns copies with id selectors
     rewritten through the map; never mutates inputs; classes untouched.

3. **`lib/cms/path.ts`** — imports `prisma` from `@/lib/prisma` (must be
   mocked). Exports `validateSlug`, `titleToSlug`, `validateTopLevelSlug`
   (pure) and `buildPath(slug, parentId)` / `assertNotDescendant(pageId,
   candidateParentId)` (DB-walking, `MAX_DEPTH = 32`). Key excerpt
   (`lib/cms/path.ts:42-60`):
   ```ts
   export async function buildPath(
     slug: string,
     parentId: string | null
   ): Promise<string> {
     if (parentId === null) return slug
     const segments: string[] = [slug]
     let current: string | null = parentId
     for (let i = 0; i < MAX_DEPTH; i++) {
       if (!current) break
       const parent: ParentLookup = await prisma.page.findUnique({
         where: { id: current },
         select: { slug: true, parentId: true },
       })
       if (!parent) throw new Error(`Parent ${current} not found.`)
       segments.unshift(parent.slug)
       current = parent.parentId
     }
     return segments.join("/")
   }
   ```
   `RESERVED_TOP_SEGMENTS = new Set(["blog", "admin", "api", "_next"])`.
   `SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/`.

4. **`lib/cms/templates.ts`** — imports `prisma` (mock it) and
   `unwrapTemplateRoot`. Test two exports:
   - `slimTemplateProject(project)` — extracts
     `{ component: p.pages[0].frames[0].component, styles: p.styles ?? [] }`;
     **throws** `"Template payload missing a root component."` when no root.
   - `resolvePageTree(tenantId, data)` — recursive resolver. Constants:
     `TEMPLATE_REF_TYPE = "template-ref"`, `SLUG_ATTR = "data-slug"`,
     `MAX_DEPTH = 16`. Behavior to characterize (read `lib/cms/templates.ts:222-325`
     in full before writing tests):
     - Returns `data` unchanged (same reference) when there is no
       `pages[0].frames[0].component`, and also when nothing resolved and no
       styles were collected.
     - A `template-ref` node is replaced by its template's component
       (slim shape `tpl.data.component`, falling back to legacy
       `tpl.data.pages[0].frames[0].component`).
     - The DB lookup goes through `loadTemplate` → `prisma.template.findMany`
       with `where: { slug, OR: [{ tenantId }, { tenantId: null }] }`,
       ordered tenant-first, `take: 1`. Mock `prisma.template.findMany`.
     - Unresolvable refs become
       `{ tagName: "div", attributes: { "data-template-placeholder": <reason> }, components: [] }`
       with reasons: `missing-slug`, `cycle:<slug>`, `missing:<slug>`,
       `empty:<slug>`, `max-depth-exceeded`.
     - Cycle guard: a slug being resolved that appears again *in its own
       chain* → `cycle:<slug>` placeholder. Two **sibling** refs to the same
       slug are NOT a cycle — both resolve.
     - Style merge: template `styles[]` are appended after page styles,
       once per slug even when referenced N times (`stylesAdded` set).
     - A document-level template root (`type: "wrapper"` or `tagName:
       "body"`) is rewritten to a `div` via `unwrapTemplateRoot`.

5. **`lib/theme/compile.ts`** — pure (verify: it should not import prisma).
   Smoke-test exports `compileTheme(theme: Theme): CompiledTheme`,
   `compiledThemeToCss(compiled): string`, and
   `presetVarName(category, slug)` (`lib/theme/compile.ts:60,249,271`).

### Repo conventions to match

- Prettier: no semicolons, double quotes, 2-space indent, trailing commas
  `es5`. Run `pnpm format` after writing files.
- TS strict; avoid `any` — use the exported types from
  `@/lib/plugins/react-renderer/project/types` (`ComponentDefinition`,
  `Rule`, `ProjectDefinition`) in fixtures.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Generate Prisma client | `pnpm prisma generate` | exit 0, writes `generated/prisma/` |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests (new) | `pnpm test` | all tests pass |
| Format | `pnpm format` | exit 0 |

## Scope

**In scope** (the only files you should create/modify):
- `package.json` (add `vitest` devDep + `"test": "vitest run"` and
  `"test:watch": "vitest"` scripts — nothing else)
- `vitest.config.ts` (create)
- `lib/cms/template-shape.test.ts` (create)
- `lib/cms/style-extract.test.ts` (create)
- `lib/cms/path.test.ts` (create)
- `lib/cms/templates.test.ts` (create)
- `lib/theme/compile.test.ts` (create)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Any file under test — these are **characterization** tests. If a test
  reveals what looks like a bug, write the test to pin the CURRENT behavior
  and note the suspicion in your report; do not fix the source.
- `tsconfig.json` — the existing `include: ["**/*.ts", ...]` already covers
  test files.
- `eslint.config.mjs`, CI config (plan 002), UI components, `lib/rag/`.

## Git workflow

- Branch: `advisor/001-verification-baseline`
- Commit per step; message style: conventional commits as in `git log`
  (e.g. `feat: add vitest config and test script`, `test: characterize resolvePageTree`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add Vitest and config

- `pnpm add -D vitest`
- Create `vitest.config.ts` at the repo root:

  ```ts
  import { fileURLToPath } from "node:url"
  import { defineConfig } from "vitest/config"

  export default defineConfig({
    resolve: {
      alias: {
        "@": fileURLToPath(new URL(".", import.meta.url)),
      },
    },
    test: {
      environment: "node",
      include: ["lib/**/*.test.ts"],
    },
  })
  ```

- Add scripts to `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`.

**Verify**: `pnpm test` → exits 0 with "no test files found" OR passes once
step 2 lands (vitest run with zero tests exits 1 on some versions — if so,
proceed to step 2 and verify there).

### Step 2: template-shape + style-extract tests (pure modules)

`lib/cms/template-shape.test.ts` — cases:
- passthrough: a `{ tagName: "section" }` node returns the same reference.
- wrapper unwrap: `{ type: "wrapper", components: [child] }` →
  `tagName: "div"`, marker attr `"data-tc-template-root": "true"`, children preserved.
- tag-based unwrap: `tagName: "BODY"` (uppercase) unwraps too.
- missing components: unwrapped root gets `components: []`.

`lib/cms/style-extract.test.ts` — cases:
- `collectComponentIdentity`: nested tree with `id`, `attributes.id`,
  `classes: ["a", { name: "b" }]`, `attributes.class: "c d"` → all collected.
- `extractStylesForSubtree`:
  - string selector shapes: bare `"my-class"`, prefixed `"#my-id"`, `".my-class"`.
  - object selector `{ name: "my-id", type: 2 }` matches ids only;
    `{ name: "x", type: 1 }` matches classes only.
  - `selectorsAdd: "#my-id > .foo"` raw-string matching.
  - non-matching rules excluded; empty identity → `[]`.
- `collectStyledIds` + `remapStyleIds`: remap `#old` → `#new` across
  `selectors` (string and object forms) and `selectorsAdd`; assert inputs
  are NOT mutated (deep-freeze the fixture or compare to a structured clone).

**Verify**: `pnpm test` → these files pass.

### Step 3: path.ts tests (mocked Prisma)

Mock the prisma module **before importing the module under test**:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: { page: { findUnique: vi.fn() } },
}))

import { prisma } from "@/lib/prisma"
import { buildPath, assertNotDescendant, validateSlug, titleToSlug } from "@/lib/cms/path"

const findUnique = vi.mocked(prisma.page.findUnique)
```

Cases:
- `validateSlug`: accepts `"about-us"`, rejects `"About"`, `"-x"`, `"a--b"`, `""`.
- `titleToSlug`: `"Hello, World!"` → `"hello-world"`; symbols-only → `""`.
- `buildPath("c", null)` → `"c"`, zero DB calls.
- `buildPath("c", "idB")` with mocked chain B(slug "b", parent "idA") →
  A(slug "a", parent null) → `"a/b/c"`, exactly 2 `findUnique` calls.
- `buildPath` with a missing parent (mock resolves null) → throws
  `Parent <id> not found.`
- `assertNotDescendant("p1", "p1")` → throws "A page cannot be its own ancestor."
- `assertNotDescendant` walking a chain that reaches `p1` mid-chain → throws;
  a chain ending at null without hitting `p1` → resolves.
- (Characterize, don't fix) a parentId **cycle** that never reaches `pageId`:
  the loop exits after `MAX_DEPTH` (32) iterations without throwing —
  assert it resolves and makes 32 calls.

Use `beforeEach(() => { findUnique.mockReset() })`. Implement the chain with
`findUnique.mockImplementation(async ({ where }) => fixtures[where.id] ?? null)`.

**Verify**: `pnpm test` → passes.

### Step 4: templates.ts resolver tests (mocked Prisma)

Same mock pattern, mocking `prisma.template.findMany`:

```ts
vi.mock("@/lib/prisma", () => ({
  prisma: { template: { findMany: vi.fn() } },
}))
```

Helper to build a page project:

```ts
const project = (root: ComponentDefinition, styles: Rule[] = []): ProjectDefinition => ({
  pages: [{ frames: [{ component: root }] }],
  styles,
})
const ref = (slug: string): ComponentDefinition => ({
  type: "template-ref",
  attributes: { "data-slug": slug },
})
```

Fixture templates are returned by `findMany` keyed on `where.slug` —
`mockImplementation(async ({ where }) => fixtures[where.slug] ? [fixtures[where.slug]] : [])`.
A fixture row needs at least `{ data: { component: {...}, styles: [...] } }`
(the resolver reads `tpl.data`).

Cases:
1. No refs → returns the **same object reference** (`expect(result).toBe(input)`).
2. Single ref → replaced by template component; template styles appended
   AFTER page styles.
3. Sibling reuse: two refs to slug `"card"` in one parent → both resolve,
   styles appended **once**.
4. Cycle: template `"a"` whose component is `ref("a")` → inner becomes
   placeholder `data-template-placeholder: "cycle:a"`.
5. Missing template → `missing:<slug>` placeholder; empty `data` →
   `empty:<slug>`; ref without `data-slug` → `missing-slug`.
6. Legacy shape: fixture with `data: { pages: [{ frames: [{ component }] }] }`
   (no `component` key) still resolves.
7. Wrapper defang: template root `{ type: "wrapper", components: [...] }` →
   resolved node has `tagName: "div"` and `"data-tc-template-root"` attr.
8. Depth: build a chain of 18 nested templates (`t0` refs `t1` refs … `t17`,
   generated in a loop) → resolution contains a `max-depth-exceeded`
   placeholder (MAX_DEPTH = 16).
9. `slimTemplateProject`: happy path; throws on `{}` / missing root.

**Verify**: `pnpm test` → passes.

### Step 5: theme compile smoke test

Read `lib/theme/compile.ts` first (you have not seen its body — only its
exports). Then `lib/theme/compile.test.ts`:

- Build a minimal valid `Theme` (import the type from `@/lib/theme/schema`):
  ```ts
  const theme: Theme = {
    version: 1,
    settings: {
      color: { palette: [{ slug: "primary", name: "Primary", value: "hsl(220 90% 56%)" }] },
    },
  }
  ```
- `compileTheme(theme)` → returns a `CompiledTheme`; `compiledThemeToCss(...)`
  → a string containing `presetVarName("color", "primary")` (use the exported
  helper rather than hardcoding the variable text) and the token value.
- One `resolveStyleRef` case if its contract is clear from the source
  (`var:preset|color|primary` → `var(<presetVarName("color","primary")>)`);
  skip if the source contradicts this.

**Verify**: `pnpm test` → all 5 files pass. Then `pnpm format`,
`pnpm typecheck`, `pnpm lint` → all exit 0.

## Test plan

(This plan IS the test plan — see steps 2–5. No existing test exists to
model after; these files become the repo's structural pattern.)

## Done criteria

- [ ] `pnpm test` exits 0; ≥ 5 test files, ≥ 30 assertions total
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] No source file under `lib/` was modified (only `*.test.ts` created)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the cited locations doesn't match the "Current state" excerpts.
- Vitest cannot resolve the `@/` alias or fails on `generated/prisma`
  imports at runtime after the mocks are in place (the modules under test
  import prisma types/values only through `@/lib/prisma` and type-only
  imports, which should be erased — if something else loads the real client,
  stop).
- A characterization test reveals behavior so different from this plan's
  description that the fixture design no longer applies (e.g. resolver
  return shape differs).
- You feel the urge to "fix" a bug in a module under test — report it instead.

## Maintenance notes

- Plans 004/005/008 modify `lib/cms/templates.ts`, theme schema, and the
  resolver — these tests are their safety net; run `pnpm test` in each.
- The depth/cycle constants (`MAX_DEPTH` 16 in templates.ts, 32 in path.ts)
  are asserted by tests; changing them requires updating tests deliberately.
- Follow-up deliberately deferred: integration tests for server actions
  (need a test DB story) and component tests (need jsdom) — out of scope here.
