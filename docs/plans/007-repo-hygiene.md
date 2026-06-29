# Plan 007: Repo hygiene batch — README, stray files, dependency placement, env docs, exhaustiveness guard

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ae527df..HEAD -- README.md package.json .env.example .gitignore lib/cms/editor-draft-actions.ts flexbox-notes.md menu.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `ae527df`, 2026-06-11

## Why this matters

Five small frictions, each individually trivial, batched here: the README is
still the stock "Next.js template" text and says nothing about the product;
two scratchpad markdown files are tracked at the repo root; the `shadcn` CLI
sits in production `dependencies` and `@types/lodash` is an unused devDep;
`.env.example` omits variables the code actually reads; and
`saveEditorDraft`'s switch silently no-ops on an unknown kind.

## Current state

1. **README.md** — verbatim stock template ("# Next.js template … npx shadcn
   add button"). The real product: a multi-tenant CMS / visual page builder
   on GrapesJS + Next.js 16 + Prisma 7, with a tenant theme system
   (WP-theme.json-inspired), a template library (LAYOUT/PATTERN/PART), and a
   draft-mode preview tree. `CLAUDE.md` holds the architecture detail;
   `docs/` holds design docs.
2. **Tracked strays** (confirmed via `git ls-files`): `flexbox-notes.md`
   (a flexbox tutorial/notes file) and `menu.md` (a scraped menu/markdown
   transcript) at the repo root. Untracked local clutter that should be
   ignored: `patterns-panel.png`, `tsconfig.tsbuildinfo`, `.DS_Store`
   (verify each is untracked with `git ls-files <file>` → empty before
   touching .gitignore).
3. **package.json**: `"shadcn": "^4.5.0"` in `dependencies` (it's the
   component-installer CLI, invoked as `pnpm dlx shadcn@latest add <name>`
   per CLAUDE.md — as a library it's unused; verify with the grep in Step 3).
   `"@types/lodash": "^4.17.24"` in devDependencies with zero lodash imports
   anywhere (verified at planning time: `grep -rn "lodash" lib app components hooks scripts` → no hits).
4. **.env.example** lists `DATABASE_URL`, `GOOGLE_API_KEY`,
   `ANTHROPIC_API_KEY`. Code reads more: `lib/rag/github.ts` and
   `scripts/ingest-grapesjs-source.ts` read `process.env.GITHUB_TOKEN`;
   `scripts/migrate-on-deploy.mjs` reads env you must inventory in Step 4
   (it was not read during planning — discover its variables yourself).
5. **lib/cms/editor-draft-actions.ts:32-53** — `switch (kind)` over the
   `EditorKind` union (`"page" | "post" | "template"`) with no `default`;
   the function returns `Promise<void>`, so a future kind added to the union
   would compile and silently skip persisting.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Generate client | `pnpm prisma generate` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | exit 0 (if plan 001 landed) |
| Format | `pnpm format` | exit 0 |

## Scope

**In scope**:
- `README.md` (rewrite)
- `docs/notes/flexbox-notes.md`, `docs/notes/menu.md` (git mv targets)
- `.gitignore` (append ignores)
- `package.json` (move `shadcn`, remove `@types/lodash` — no other change)
- `.env.example` (append documented vars)
- `lib/cms/editor-draft-actions.ts` (exhaustiveness guard only)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `CLAUDE.md` — it's accurate; README should link to it, not duplicate it.
- Any other dependency change (upgrades are a separate concern — see index).
- `lib/rag/` code, `scripts/` code (read-only for the env inventory).
- Deleting `patterns-panel.png`/`tsconfig.tsbuildinfo` from disk — ignore
  them; deletion is the operator's call.

## Git workflow

- Branch: `advisor/007-repo-hygiene`
- One commit per numbered step (`docs: rewrite README for the actual product`,
  `chore: move root scratch notes into docs/notes`, etc.)
- Use `git mv` for the moves so history follows.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Rewrite README.md

Replace the full contents with a product README. Required sections (write
naturally, don't copy this skeleton verbatim):

- **Title + one-paragraph description**: multi-tenant CMS and visual page
  builder; GrapesJS editor, React-rendered previews, per-tenant theming,
  reusable template library.
- **Stack**: Next.js 16 (App Router/RSC), React 19, TypeScript strict,
  Tailwind v4, shadcn/ui, Prisma 7 + Postgres, GrapesJS. Package manager pnpm.
- **Getting started**: copy `.env.example` → `.env`, `pnpm install`,
  `pnpm prisma migrate dev`, `pnpm dev`.
- **Commands**: dev/build/lint/typecheck/format (+ `test` if plan 001 landed).
- **Where things live**: one line each for `app/`, `components/`, `lib/cms`,
  `lib/plugins`, `lib/theme`, `prisma/`, `docs/` — and a pointer:
  "Architecture details and conventions: see `CLAUDE.md`; design docs in `docs/`."

**Verify**: `grep -c "Next.js template" README.md` → 0.

### Step 2: Move the stray notes

```sh
mkdir -p docs/notes
git mv flexbox-notes.md docs/notes/flexbox-notes.md
git mv menu.md docs/notes/menu.md
```

Then append to `.gitignore` (only after confirming each is untracked):

```
# local scratch artifacts
patterns-panel.png
tsconfig.tsbuildinfo
.DS_Store
```

**Verify**: `git ls-files flexbox-notes.md menu.md` → empty;
`git status --porcelain | grep -E "patterns-panel|tsbuildinfo|DS_Store"` → empty.

### Step 3: Fix dependency placement

- Confirm `shadcn` is not imported at runtime:
  `grep -rn "from \"shadcn\"\|require(\"shadcn\")" app components lib hooks scripts` → empty.
  Then move `"shadcn": "^4.5.0"` from `dependencies` to `devDependencies`.
- Remove `"@types/lodash"` from `devDependencies`.
- `pnpm install` to refresh the lockfile.

**Verify**: `pnpm typecheck && pnpm lint` → exit 0; `pnpm build` is NOT
required (don't run it — `prebuild` touches deploy migration logic).

### Step 4: Complete .env.example

- Inventory: `grep -rn "process.env\." app lib scripts --include="*.ts" --include="*.tsx" --include="*.mjs" | grep -v node_modules | sort -u`
- For each variable not yet in `.env.example`, append it with a one-line
  comment stating which code reads it and whether it's optional. Known at
  planning time: `GITHUB_TOKEN` (optional; raises GitHub API rate limits for
  `pnpm ingest:grapesjs-source` / `lib/rag/github.ts`). Read
  `scripts/migrate-on-deploy.mjs` and document its variables (likely a
  Vercel-provided var and/or an unpooled DATABASE_URL variant) marked
  "Vercel deploy only — not needed locally".
- Do NOT put real values anywhere; keys only.

**Verify**: every `process.env.X` hit from the inventory either appears in
`.env.example` or is a framework-provided var (`NODE_ENV`, `VERCEL*`) —
list any you intentionally skipped in the commit message.

### Step 5: Exhaustiveness guard in saveEditorDraft

In `lib/cms/editor-draft-actions.ts`, the switch currently ends after
`case "post"`. Add:

```ts
default: {
  // Exhaustiveness guard — a new EditorKind must wire its own persistence.
  const unreachable: never = kind
  throw new Error(`Unknown editor kind: ${String(unreachable)}`)
}
```

(The `never` assignment makes the compiler fail when `EditorKind` grows —
that's the actual goal; the runtime throw is the backstop.)

**Verify**: `pnpm typecheck` → exit 0; `pnpm test` (if plan 001 landed) →
pass; `pnpm format` → run before committing.

## Test plan

No new tests (config/docs churn + a `never` guard the compiler enforces).
If plan 001 landed, `pnpm test` must stay green throughout.

## Done criteria

- [ ] README describes the actual product; stock text gone
- [ ] `git ls-files` no longer lists root `flexbox-notes.md` / `menu.md`; both exist under `docs/notes/`
- [ ] `package.json`: `shadcn` in devDependencies, `@types/lodash` absent; `pnpm-lock.yaml` updated
- [ ] `.env.example` covers the inventoried variables
- [ ] `default:` never-guard present in `editor-draft-actions.ts`
- [ ] `pnpm typecheck`, `pnpm lint` (and `pnpm test` if present) all exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `shadcn` IS imported somewhere at runtime — leave it in dependencies and
  report.
- `git ls-files patterns-panel.png` (or tsbuildinfo/.DS_Store) is non-empty —
  the file is tracked, and untracking is a history decision for the operator;
  skip that file and report.
- `scripts/migrate-on-deploy.mjs` reads env in a way you can't confidently
  document — describe what you see and ask, don't guess in the example file.

## Maintenance notes

- README's command list will drift as plans 001/002 land — whoever merges
  later should reconcile.
- The `never` guard means adding an `EditorKind` now produces a compile
  error in this file — that's intentional; the fix is wiring real
  persistence, not deleting the guard.
