# Plan 003: Cancel the pending autosave debounce when an explicit Save/Publish commits

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ae527df..HEAD -- components/page-builder/editor-shell.tsx`
> If the file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `ae527df`, 2026-06-11

## Why this matters

The editor autosaves drafts to the `draftData` DB column through a ~1s
trailing debounce. The explicit Save/Publish path (`augmentedSave`) posts the
live canvas state to a server action which writes `data` and **clears**
`draftData` (`draftData: Prisma.DbNull` — see `lib/cms/page-actions.ts:101-103`,
`post-actions.ts:75-77`, `template-actions.ts:108-110`). But `augmentedSave`
never cancels a pending debounce. Sequence: user edits → debounce queued →
user clicks Save/Publish within 1s → server clears `draftData` → the queued
debounce fires and **re-writes `draftData`**. The editor then seeds from
`draftData ?? data` on next load and reports itself "ahead" of the published
state when it isn't. No data is lost, but the draft state machine lies after
exactly the action that's supposed to settle it.

## Current state

All in `components/page-builder/editor-shell.tsx` (a ~860-line `"use client"`
component).

Debounce machinery (`editor-shell.tsx:571-601`, abridged):

```tsx
const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
  null
)
const pendingDraftRef = React.useRef<ProjectData | null>(null)
const debouncedPersist = React.useCallback(
  (data: ProjectData): Promise<void> => {
    pendingDraftRef.current = data
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null
      const payload = pendingDraftRef.current
      pendingDraftRef.current = null
      if (payload) {
        void persistDraftRef.current(payload).catch((err) => { /* toast */ })
      }
    }, 1000)
    return Promise.resolve()
  },
  []
)
```

There is also an unmount-flush effect right after it (`editor-shell.tsx:~604-620`)
that clears the timer and flushes the pending payload on unmount — do not
remove or weaken it.

The save path (`editor-shell.tsx:~723-748`):

```tsx
const augmentedSave = React.useCallback(
  async (formData: FormData) => {
    const editor = editorRef.current
    if (editor) {
      const filtered = filterProtectedStyles(editor.getProjectData())
      formData.set("data", JSON.stringify(filtered))
    }
    await saveAction(formData)
    // Commit succeeded: `data` now matches the canvas and the server
    // cleared any pending draft, so the editor is no longer ahead.
    editorSaveStore.committed()
    ...
  },
  [saveAction]
)
```

Repo conventions: Prettier (no semicolons, double quotes, 2-space), comments
explain *why* in full sentences (match the density you see above).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Generate client | `pnpm prisma generate` | exit 0 (needed for typecheck) |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | exit 0 (if plan 001 landed) |
| Format | `pnpm format` | exit 0 |

## Scope

**In scope** (the only file you should modify):
- `components/page-builder/editor-shell.tsx`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `lib/cms/*-actions.ts` — the server-side clearing behavior is correct.
- The unmount-flush effect — its flush semantics must remain (navigating
  away with un-debounced edits still persists them).
- `lib/plugins/tc-storage-adapter.ts` and the GrapesJS storage wiring.

## Git workflow

- Branch: `advisor/003-cancel-autosave-on-save`
- One commit, e.g. `fix: cancel pending draft autosave when an explicit save commits`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a cancel helper next to the debounce refs

Directly after the `debouncedPersist` callback definition, add:

```tsx
// An explicit Save/Publish posts the freshest getProjectData() itself and
// the server clears `draftData` — a debounce queued before the click is
// stale by definition and, if allowed to fire after the commit, would
// resurrect `draftData` and leave the editor claiming to be "ahead" of
// what it just published. Drop both the timer and the captured payload.
const cancelPendingDraft = React.useCallback(() => {
  if (debounceTimerRef.current) {
    clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = null
  }
  pendingDraftRef.current = null
}, [])
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Call it at the top of `augmentedSave`

In `augmentedSave`, before `formData.set(...)`/`await saveAction(formData)`,
add `cancelPendingDraft()` as the first statement, and add
`cancelPendingDraft` to the `React.useCallback` dependency array
(`[saveAction]` → `[saveAction, cancelPendingDraft]`).

Cancel **before** `await saveAction(formData)` (not after): the freshest
state is read synchronously into `formData` on the same tick, so the pending
payload is strictly stale; cancelling first also closes the window where the
debounce fires *during* the awaited server action.

**Verify**:
- `pnpm typecheck` → exit 0
- `pnpm lint` → exit 0
- `grep -n "cancelPendingDraft()" components/page-builder/editor-shell.tsx`
  → exactly one call site, inside `augmentedSave`, before `saveAction`.

### Step 3: Confirm the unmount flush still works as written

Re-read the unmount effect (the one returning a cleanup that flushes
`pendingDraftRef`). It reads the same refs; cancelling in `augmentedSave`
nulls them, so a post-save unmount flushes nothing — which is correct
(nothing is pending). No code change expected in this step; it's a review
gate.

**Verify**: `pnpm format && pnpm typecheck && pnpm lint && pnpm test` (test
only if plan 001 landed) → all exit 0.

## Test plan

This is client-component behavior with GrapesJS in the loop; the repo has no
component-test rig (jsdom) and adding one is out of scope. Verification is:
typecheck/lint/grep gates above, plus a manual smoke check for the operator
(documented in your report): in the editor, make an edit and click "Save
draft"/Publish within 1 second; after reload the editor must NOT show a
draft-ahead state. If a component-test rig exists by the time you execute
(check for jsdom/`@testing-library` in `package.json`), add a test that
fires `augmentedSave` with a queued debounce and asserts `persistDraft` is
never called afterward.

## Done criteria

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `grep -c "cancelPendingDraft" components/page-builder/editor-shell.tsx` → ≥ 3 (definition + call + dep array)
- [ ] The unmount-flush effect is unchanged (`git diff` shows no edits to it)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `augmentedSave` or the debounce block no longer match the excerpts above
  (the file is high-churn).
- You find `cancelPendingDraft` (or equivalent cancellation) already exists —
  the fix may have landed independently; mark the plan REJECTED in the index.
- Fixing this appears to require changes to the storage adapter or server
  actions.

## Maintenance notes

- If a "save and continue editing" flow is added later, the cancel must stay
  *before* the form-data snapshot — revisit if `augmentedSave` is restructured.
- Reviewer should scrutinize: the `useCallback` dependency arrays (the
  helper is stable, but React lint must agree) and that no other caller of
  `saveAction` bypasses `augmentedSave`.
