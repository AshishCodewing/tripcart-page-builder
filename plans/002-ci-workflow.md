# Plan 002: Add a GitHub Actions CI gate (typecheck + lint + test)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ae527df..HEAD -- package.json prisma.config.ts scripts/sync-vendor-css.mjs`
> If any in-scope-adjacent file changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-verification-baseline.md (for the test step; see Step 2 note if 001 has not landed)
- **Category**: dx
- **Planned at**: commit `ae527df`, 2026-06-11

## Why this matters

There is no CI: `.github/` does not exist. `pnpm typecheck` and `pnpm lint`
exist but nothing runs them on push/PR. This is riskier than usual here
because the repo deploys to Vercel from `main` and the `prebuild` script
**auto-applies Prisma migrations to the production database** on every
production build (`package.json`: `"prebuild": "node scripts/sync-vendor-css.mjs && prisma generate && node scripts/migrate-on-deploy.mjs"`).
A type error or broken migration merged to `main` goes straight at prod.
A CI gate on PRs catches this before merge.

## Current state

- `.github/` directory: absent.
- `package.json` relevant scripts:
  ```json
  "predev": "node scripts/sync-vendor-css.mjs",
  "prebuild": "node scripts/sync-vendor-css.mjs && prisma generate && node scripts/migrate-on-deploy.mjs",
  "postinstall": "node scripts/sync-vendor-css.mjs",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  ```
  Plus `"test": "vitest run"` if plan 001 has landed.
- `pnpm-lock.yaml` is the lockfile (pnpm is the package manager). Local node
  is v24 (Node 24 LTS).
- `postinstall` runs `scripts/sync-vendor-css.mjs`, which only copies CSS
  files from `node_modules/open-props/` into `public/vendor/` — safe in CI,
  no env needed.
- **Typecheck requires the generated Prisma client**: source imports
  `@/generated/prisma/client`, and `generated/` is git-ignored. CI must run
  `pnpm prisma generate` before `tsc`. `prisma generate` does not connect to
  a database, but `prisma.config.ts` loads `.env` via `dotenv/config` and
  references `process.env.DATABASE_URL` — a dummy value may be required.
- The Prisma schema uses the `prisma-client` generator with
  `previewFeatures = ["postgresqlExtensions"]` and outputs to
  `../generated/prisma` (see `prisma/schema.prisma`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Generate client | `pnpm prisma generate` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | exit 0 (only if plan 001 landed) |
| Workflow lint (optional) | `gh workflow list` after push | workflow appears |

## Scope

**In scope** (the only files you should create/modify):
- `.github/workflows/ci.yml` (create)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `package.json` scripts — CI calls the existing ones.
- `scripts/migrate-on-deploy.mjs` — deploy-time migration is Vercel's job;
  CI must NOT run it or connect to any real database.
- Branch-protection settings (needs repo admin; recommend in your report
  instead).
- Vercel config.

## Git workflow

- Branch: `advisor/002-ci-workflow`
- Single commit, e.g. `ci: add typecheck/lint/test workflow`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      # prisma.config.ts reads DATABASE_URL via dotenv; generate does not
      # connect, this value just satisfies the config load.
      DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci"
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
```

Note: `pnpm/action-setup@v4` reads the pnpm version from
`packageManager`/lockfile; if it errors asking for an explicit version, add
`with: { version: 10 }` (check the major in `pnpm-lock.yaml`'s
`lockfileVersion` / your local `pnpm --version`).

**If plan 001 has NOT landed yet** (no `test` script in `package.json`):
omit the `pnpm test` line and note in `plans/README.md` that it must be
added when 001 lands.

**Verify**: `cat .github/workflows/ci.yml` parses as valid YAML
(`node -e "require('js-yaml')"` is unavailable — instead use
`python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"` → exit 0).

### Step 2: Dry-run the same sequence locally

Run exactly what CI will run, in order, from a clean-ish state:

```sh
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm typecheck
pnpm lint
pnpm test   # only if 001 landed
```

**Verify**: every command exits 0. If `pnpm prisma generate` fails because
of the dummy `DATABASE_URL`, test with
`DATABASE_URL="postgresql://ci:ci@localhost:5432/ci" pnpm prisma generate`
— if it still fails, STOP (see conditions).

## Test plan

No unit tests for YAML. The verification is Step 2's local dry-run plus the
first CI run after the branch is pushed (operator's call).

## Done criteria

- [ ] `.github/workflows/ci.yml` exists and YAML-parses
- [ ] The full local dry-run sequence (Step 2) exits 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `pnpm prisma generate` requires a *real* database connection (it should
  not) — report the exact error rather than wiring credentials into CI.
- `pnpm lint` or `pnpm typecheck` fail on the current `main` — the gate
  can't land red; report the pre-existing failures instead of fixing them
  (fixes belong in their own change).
- You are tempted to add deploy/migration steps to CI — that is explicitly
  out of scope.

## Maintenance notes

- When plan 001 lands (if it landed after this), add the `pnpm test` step.
- Recommend to the operator: enable branch protection on `main` requiring
  this workflow — CI without a required check still lets red merges through.
- If a build step is ever added to CI (`pnpm build`), it will trigger
  `prebuild`, which runs `migrate-on-deploy.mjs` — that script must remain
  guarded against non-Vercel environments before CI ever builds (check its
  guard first).
