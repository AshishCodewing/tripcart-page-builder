# Plan 010: Per-instance overrides on synced templates (§11) — design spike

> **Executor instructions**: This is a DESIGN SPIKE — the deliverable is a
> design document, not code. You may not modify any source file; your only
> writable outputs are `docs/template-overrides-design.md` and the status
> row in `plans/README.md`. Investigate read-only, design, document. If
> anything in the "STOP conditions" section occurs, stop and report.
>
> **Required reading before step 1**: `docs/reference/templates-followups.md` §11
> (the maintainer's design sketch — this spike refines it into a buildable
> spec), §7 (canvas inlining — the editing surface overrides must hook
> into), and `docs/reference/templates.md`.
>
> **Drift check (run first)**: `git diff --stat ae527df..HEAD -- lib/cms/templates.ts lib/plugins/template-ref.ts docs/reference/templates-followups.md`
> Drift is acceptable — inventory current state.

## Status

- **Priority**: P3 (direction — maintainer-selected)
- **Effort**: M (spike; the build that follows is M–L per §11)
- **Risk**: LOW (no code changes)
- **Depends on**: none strictly; SHOULD follow plans/008-layout-content-slot.md (both extend `resolveNode` — design against its post-008 shape). **008 is now Approach A**: it adds a `content-slot` *boundary* branch to `resolveNode` (before the `template-ref` branch). Overrides are **orthogonal** — they apply *inside* the `template-ref` branch on ref expansion, which A does not touch. The only coordination is that the slot branch is a new sibling in the same function; keep merge order clean (008 first). See `docs/reference/templates-followups.md` §14.
- **Category**: direction
- **Planned at**: commit `ae527df`, 2026-06-11 (reconciled to Approach A 2026-06-15)

## Why this matters

Synced templates are all-or-nothing: a "team card" with fixed layout but
per-instance name/photo can't be expressed — either every instance shows the
same content (synced) or the layout stops propagating (unsynced copy).
WordPress closed this gap in 6.6 with pattern overrides / block bindings.
`docs/reference/templates-followups.md` §11 sketches the model (binding names on
template children via `data-tc-binding`, override values stored on the
consuming `template-ref` node, applied at resolve time) but leaves the
authoring UX, binding kinds, and edit-on-canvas mechanics undesigned. This
spike turns the sketch into a spec a build plan can be written from.

## Current state (anchors to design against)

- **Resolver**: `lib/cms/templates.ts` `resolveNode` (lines 258-311) — the
  template-ref branch is where override application slots in: after
  `unwrapTemplateRoot`, before/while recursing. The ref node's
  `attributes["data-overrides"]` (per §11: a JSON string keyed by binding
  name) is available at that point.
- **Ref node shape** (stored in `Page.data`):
  `{ type: "template-ref", attributes: { "data-slug": slug } }`. The editor
  plugin (`lib/plugins/template-ref.ts`) inlines the resolved tree as
  **locked, non-layerable** children with `model.toJSON` stripping them —
  any on-canvas override editing must work inside that locked subtree
  (§7's "clicking bubbles to the ref" behavior is the constraint).
- **Template editor**: same `EditorShell`; templates are edited as wrapped
  projects. Authoring a binding = setting an attribute on a child component
  inside the template editor — GrapesJS traits are the native surface
  (`editor.Components.addType` trait config; see how `template-ref.ts`
  registers types).
- **Validation layer**: plan 004 (if landed) adds the payload schema where
  the `data-overrides` JSON-in-attribute would be sanity-checked.

## Commands you will need (read-only)

| Purpose | Command |
|---|---|
| Inspect ref plugin's trait usage | `grep -n "trait" lib/plugins/template-ref.ts lib/plugins/patterns -r` |
| Inlined-children locking details | read `lib/plugins/template-ref.ts` in full |
| Resolver shape | read `lib/cms/templates.ts:258-311` |
| WP prior art (already ingested in the maintainer's RAG) | note in doc: WP block bindings / pattern overrides semantics from public docs |

## Scope

**In scope (writable)**: `docs/template-overrides-design.md`,
`plans/README.md`.

**Out of scope**: ALL source files. No prototype code in the repo — code
sketches live inside the design doc as fenced blocks.

## Steps

### Step 1: Pin the data contract

Specify exactly, with JSON examples:

- **Binding declaration** (template side): attribute name
  (`data-tc-binding`), allowed binding kinds — §11 names three: `text`
  (replace `content`/text children), `attribute` (named attr: `href`,
  `src`, `alt`), `rich` (replace child markup) — recommend which subset is
  v1 (advisor's prior: text + attribute; rich is where edit-UX cost
  explodes). Decide whether kind is implicit from the component type or
  explicit (`data-tc-binding-kind`).
- **Override storage** (page side): `data-overrides` JSON on the ref's
  attributes, keyed by binding name, value shape per kind. Versioning rules
  from §11: missing override → template default renders; orphaned override
  → inert, stripped on next save or left (pick one, justify).
- **Scoping**: binding names are template-scoped; lookup key is
  `(refSlug, bindingName)` — confirm no global registry is needed.

### Step 2: Resolver application spec

Spec the change to `resolveNode`'s ref branch (post-008 Approach-A shape —
the `content-slot` boundary branch sits before the ref branch but does not
interact with overrides):
parse `data-overrides` once per ref; while resolving the template subtree,
match nodes carrying `data-tc-binding`; apply the override per kind
(text → replace `components`/`content` of that node; attribute → merge into
`attributes`). Define edge cases: override targeting a binding inside a
*nested* synced template (recommend: outer ref's overrides do NOT reach
inner refs in v1 — WP matches this); binding on the template root;
override + cycle placeholder interaction. Include the cost note from §11
(one Map check per node — no asymptotic change). Specify the new unit tests
(extend the plan-001 resolver suite) the build plan must include.

### Step 3: Editor UX spec (the hard part — be honest about cost)

- **Authoring**: a trait (GrapesJS trait UI) on any component inside the
  template editor: "Binding name" text input (+ kind select if explicit).
  Spec where the trait registers globally vs per-type, referencing the
  "Toolbar extension reference" / extend-propagation caveat at the bottom of
  `docs/reference/templates-followups.md` (pattern C — subscribe + mutate — is the
  house style for cross-type augmentation).
- **Consuming**: per §11, clicking an overridable node inside the locked
  inlined preview should unlock *just enough* to edit the bound property.
  Evaluate against the actual locking mechanism in `template-ref.ts`
  (locked + non-layerable children, `toJSON` stripping): the override edit
  cannot persist through the child (it's stripped) — it must write to the
  ref's `data-overrides` attribute. Spec the event flow:
  double-click overridable child → plugin intercepts → writes attribute →
  re-inlines preview. Flag the risky bits (undo/redo, §7 re-inline timing)
  as prototype questions.
- **Fallback v0** (recommend shipping first): no in-canvas editing — select
  the ref, and the right-panel/Settings shows a generated form (one field
  per binding found in the referenced template). Vastly cheaper; spec it
  fully and make canvas-inline editing the v1 follow-up.

### Step 4: Write `docs/template-overrides-design.md`

Sections: **Context**, **Data contract** (Step 1), **Resolver spec +
test list** (Step 2), **Editor UX: v0 form-based / v1 in-canvas** (Step 3),
**Build-plan outline** (ordered steps with effort tags; v0 should be
S/M-sized), **Open questions** (orphan-override policy if unresolved,
rich-binding fate, interaction with §13 array-rooted templates).

**Verify**: doc exists with all sections; every design choice either cites
§11/§7 or marks itself as a deviation with a reason; `git status` shows only
the two writable files.

## Test plan

Not applicable (design doc). Step 2 must enumerate the resolver test cases
the future build plan will implement.

## Done criteria

- [ ] `docs/template-overrides-design.md` exists with all six sections
- [ ] Data contract has concrete JSON examples for declaration + override
- [ ] v0 (form-based) is fully specified and separable from v1 (in-canvas)
- [ ] Deviations from §11 are explicitly flagged
- [ ] `git status` shows only the memo + index changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- §11 has materially changed in `docs/reference/templates-followups.md` since
  planning — re-read and report before designing against stale intent.
- You start prototyping in source files — out of scope.

## Maintenance notes

- The build plan that follows should land after plan 008 (both edit
  `resolveNode`; 008 first keeps merge order clean) and depends on plan 001
  for the resolver test harness. Under Approach A the canvas editing surface
  overrides hook into (§7 locked inlined `template-ref` children) is
  **unchanged** — A restructures chrome/LAYOUT rendering, not ref inlining —
  so the Step 3 UX spec stands as written.
- If plan 004 landed, the `data-overrides` JSON-in-attribute should be
  covered by `validateComponentPayload`'s passthrough (no schema change
  expected — confirm in the build plan).
