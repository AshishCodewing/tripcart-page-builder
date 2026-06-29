# Plan 005: Make Zod the single source of truth for the Theme document schema

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ae527df..HEAD -- lib/theme`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (types-only refactor; runtime validator behavior must not change)
- **Depends on**: plans/001-verification-baseline.md (compile smoke tests catch accidental behavior change)
- **Category**: tech-debt
- **Planned at**: commit `ae527df`, 2026-06-11

## Why this matters

The Theme document has two hand-synchronized definitions:
`lib/theme/schema.ts` (165 lines of TS types — the "authoring contract") and
`lib/theme/schema.zod.ts` (168 lines of Zod — the "wire-validation
contract"). The zod file's own header says: *"they're hand-kept in sync
rather than derived … If you change one, change the other. Drift is caught
by Zod failing on a previously-valid payload at runtime."* Runtime-only
drift detection on a persistence gate is the worst place to discover a
schema mismatch. Zod 4 infers types well enough to derive the TS contract
from the validator: one definition, drift impossible by construction.

## Current state

- `lib/theme/schema.ts` exports (all consumed elsewhere — preserve every
  exported name): `ThemeVersion`, `CssValue`, `Token`, `FontSizeToken`,
  `TokenRegistry`, `StyleRef`, `ColorStyle`, `TypographyStyle`, `BoxStyle`,
  `SpacingStyle`, `BorderStyle`, `StyleBlock`, `PseudoStyleBlock`,
  `ElementName`, `StyleDefaults`, `CustomTree`, `Theme`.
  Notable details:
  - `CssValue = string`, `StyleRef = string` (documentation-carrying aliases).
  - `PseudoStyleBlock = StyleBlock & { ":hover"?: StyleBlock; ":focus"?; ":active"?; ":visited"? }`.
  - `StyleDefaults = StyleBlock & { elements?: Partial<Record<ElementName, PseudoStyleBlock>>; components?: Record<string, PseudoStyleBlock> }`.
  - `CustomTree = { [key: string]: CssValue | CustomTree }` (recursive).
  - `Theme = { version: ThemeVersion; settings: TokenRegistry; styles?: StyleDefaults; custom?: CustomTree }`.
- `lib/theme/schema.zod.ts` mirrors all of it. **Structural quirk that
  matters for inference**: several schema constants bake `.optional()` into
  the constant itself (e.g. `colorStyleSchema = z.object({...}).optional()`),
  which would infer `| undefined` at the wrong layer if used naively.
  When restructuring, define plain object schemas and apply `.optional()`
  at each usage site instead.
- The only runtime consumer of the validator:
  `lib/cms/tenant-actions.ts:7,91` (`themeSchema.safeParse`).
- Importers of the TS types (verify with the grep in Step 1):
  at minimum `lib/theme/compile.ts`, `lib/theme/presets.ts`,
  `lib/theme/theme-store.ts`, `lib/cms/tenants.ts`, `lib/cms/tenant-actions.ts`,
  `lib/tokens/index.ts`, theme admin pages/components.
- File-level doc comments in both files are good and must survive (moved,
  not deleted).
- Zod is v4 (`zod: ^4.4.3`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Generate client | `pnpm prisma generate` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | all pass (incl. plan-001 compile smoke tests) |
| Importer inventory | `grep -rln "from \"@/lib/theme/schema\"" app lib components hooks` | list to re-verify after |

## Scope

**In scope**:
- `lib/theme/schema.zod.ts` (restructure: plain object schemas, optionality
  at usage sites, export the sub-schemas needed for inference)
- `lib/theme/schema.ts` (becomes a re-export module: `z.infer` aliases that
  preserve every currently-exported name + the doc comments)
- `lib/theme/schema.test.ts` (create — equivalence tests)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Every importer of `@/lib/theme/schema` — the whole point is that none of
  them change. If one *must* change, STOP.
- `lib/theme/compile.ts`, `presets.ts`, `theme-store.ts` behavior.
- Validation strictness: the validator must accept and reject exactly the
  same payloads as before (no `.strict()`, no added constraints).

## Git workflow

- Branch: `advisor/005-theme-schema-single-source`
- Commits: one for the zod restructure, one for the schema.ts derivation,
  one for tests. Conventional style (`refactor: derive Theme types from the Zod schema`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Inventory importers and pin current behavior

- Run the importer grep (table above); save the list.
- Write `lib/theme/schema.test.ts` BEFORE refactoring:
  - a representative full Theme fixture (tokens in every category, fluid
    font size, styles with elements + components + pseudo blocks, nested
    `custom` tree) → `themeSchema.safeParse(...).success === true`.
  - invalid fixtures: wrong `version` (2), token missing `slug`, `custom`
    leaf that is a number → `success === false`.
  - a `z.infer<typeof themeSchema>` value assigned to the imported `Theme`
    type and vice versa (compile-time assertion via two
    `const _a: Theme = parsed.data` / `const _b: z.infer<...> = themeFixture`
    lines) — this is the drift detector.

**Verify**: `pnpm test` → new tests pass against the CURRENT code.

### Step 2: Restructure schema.zod.ts for clean inference

- Unwrap the `.optional()`-baked constants into plain object schemas;
  apply `.optional()` at each reference site so the inferred shape matches
  the TS contract exactly (e.g. `color: colorStyleSchema.optional()`).
- For `PseudoStyleBlock` and `StyleDefaults`, `.extend(...)` already mirrors
  the intersection types — keep that.
- Keep `customTreeSchema: z.ZodType<CustomTree> = z.lazy(...)`; recursive
  types still need the hand-written `CustomTree` type, which will continue
  to live as a plain type (now in schema.zod.ts or kept in schema.ts —
  executor's choice; document it).
- Export every sub-schema whose inferred type schema.ts needs:
  `tokenSchema`, `fontSizeTokenSchema`, `tokenRegistrySchema`,
  `colorStyleSchema`, `typographyStyleSchema`, `boxStyleSchema`,
  `spacingStyleSchema`, `borderStyleSchema`, `styleBlockSchema`,
  `pseudoStyleBlockSchema`, `styleDefaultsSchema`, `themeSchema`.

**Verify**: `pnpm test` → Step-1 tests still pass (validator behavior
unchanged); `pnpm typecheck` → exit 0.

### Step 3: Derive schema.ts

Replace the hand-written types with inferred aliases, preserving names and
the documentation (move the file-header prose and per-type comments onto the
aliases):

```ts
import type { z } from "zod"
import type {
  themeSchema,
  tokenSchema,
  /* ... */
} from "./schema.zod"

export type ThemeVersion = 1
export type CssValue = string
export type StyleRef = string
export type Token = z.infer<typeof tokenSchema>
export type FontSizeToken = z.infer<typeof fontSizeTokenSchema>
/* ... one alias per exported name ... */
export type Theme = z.infer<typeof themeSchema>
```

Notes:
- `ElementName` has no standalone Zod schema (elements are individual keys);
  keep it as the hand-written union — it's a key list, not a payload shape —
  OR derive as `keyof z.infer<typeof elementsSchema>` if you export
  `elementsSchema`. Either is acceptable; pick one and say so.
- `CssValue`/`StyleRef` stay hand-written string aliases (they only carry
  documentation; Zod sees plain strings).
- Watch for inference differences: `z.infer` of `.optional()` fields gives
  `prop?: T | undefined` — under this repo's tsconfig
  (`exactOptionalPropertyTypes` is NOT enabled) that is assignment-compatible
  with the old `prop?: T`. If typecheck disagrees anywhere, STOP.

**Verify**:
- `pnpm typecheck` → exit 0 **with zero edits to any importer** (check
  `git status` — only the three in-scope lib/theme files + test changed).
- `pnpm test` → all pass, incl. plan-001 `compile.test.ts`.
- `pnpm lint` → exit 0.

### Step 4: Update the contract comments

The schema.zod.ts header currently documents the hand-sync contract — rewrite
it to state the new contract: *Zod is the single source of truth; `schema.ts`
re-exports inferred types; edit only this file.* Keep the explanation of
where validation runs (`updateTenantTheme`) intact.

**Verify**: `grep -n "hand-kept in sync" lib/theme/*.ts` → no matches.

## Test plan

- `lib/theme/schema.test.ts` (Step 1): valid/invalid payload cases + the
  bidirectional compile-time assignability assertions between `Theme` and
  `z.infer<typeof themeSchema>`.
- Existing plan-001 `lib/theme/compile.test.ts` re-run unchanged.
- Verification: `pnpm test` → all pass.

## Done criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `git status` confirms no importer outside `lib/theme/` was modified
- [ ] `grep -n "hand-kept in sync" lib/theme` → no matches
- [ ] Every name previously exported from `lib/theme/schema.ts` is still
      exported (compare against the list in "Current state")
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any importer outside `lib/theme/` needs edits to keep typechecking — the
  derived types are not equivalent; report the mismatch instead of papering
  over it with casts.
- Step 1's compile-time assignability assertions fail against the CURRENT
  code — that means the two files have **already drifted**; report the drift
  (that's a finding, and fixing it changes validation behavior, which needs
  a human decision).
- Zod 4 inference of the recursive `customTreeSchema` produces a type that
  can't satisfy `CustomTree`.

## Maintenance notes

- Future theme-schema changes are now one-file edits in `schema.zod.ts`;
  the README/CLAUDE.md note about the theme system needn't change.
- Reviewer should scrutinize: the generated `.d.ts`-level shape of `Theme`
  (hover in editor / `tsc --noEmit` is the gate) and that no `.strict()`
  or constraint changes crept into the validator.
- Deliberately deferred: applying the same single-source treatment to the
  project-payload schema from plan 004 (there the TS types belong to the
  renderer and stay authoritative — different trade-off, documented there).
