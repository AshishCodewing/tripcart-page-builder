# Per-instance overrides on synced templates — design

> **⚠️ BUILD DEFERRED (2026-06-16).** The maintainer parked this feature —
> the synced and unsynced template modes cover current needs, and overrides
> are an additive enhancement, not a blocker. This design is complete and
> ready to build *if/when greenlit* (it needs no `Template.data` or
> payload-schema change). Revisit when a concrete use-case (e.g. a team page
> wanting shared layout + per-card name/photo) makes the gap painful.

> Design spike output for `plans/010-synced-overrides-spike.md`. **No source
> code was changed by this spike** — this is a design document plus a
> build-plan outline. Investigated read-only at commit `0647dcc`. Refines
> `docs/reference/templates-followups.md` §11 into a buildable spec; cites
> §11 / §7 for every inherited decision and flags deviations explicitly.

## 1. Context

Synced templates are all-or-nothing: a "team card" with a fixed layout but
per-instance name/photo can't be expressed — either every instance is
identical (synced) or the layout stops propagating (unsynced copy). §11
sketches the fix — mark template children as overridable with a binding
name, store per-instance values on the consuming `template-ref`, apply at
resolve time — modeled on WordPress 6.6 pattern overrides / block bindings.
This spike pins the data contract, the resolver change, and (the hard part)
the authoring + consuming UX, and recommends a cheap v0 that ships before
the in-canvas v1.

**Anchors verified in the current code** (the §10 plan's line numbers are
stale — `templates.ts` gained the §9 slim shape since; here are the live
anchors):

- **Resolver** — `lib/cms/templates.ts` `resolveNode`, the `template-ref`
  branch (`:324-360`). It looks up the template, `unwrapTemplateRoot`s the
  root (`:345`), then recurses `resolveNode(ctx, tplRoot, depth+1)` (`:348`)
  and merges the template's `styles` once per slug via `ctx.stylesAdded`
  (`:351-357`). The ref node's `attributes` — where `data-overrides` would
  live — are in hand at `:324`. (Confirmed: there is **no** `content-slot`
  branch; Approach A was reverted, as the plan's note says.)
- **Ref node shape** (in `Page.data`):
  `{ type: "template-ref", attributes: { "data-slug": slug } }`.
- **`toJSON` preserves all attributes** — `lib/plugins/template-ref.ts:453`
  returns `{ type, attributes: { ...model.getAttributes() } }` (only
  `DEPTH_ATTR` is deleted). **So `data-overrides` set on the ref survives
  save with no plugin/`toJSON` change** — a meaningful simplification over
  §11's implicit assumption.
- **Inlined preview (§7)** — children are appended `locked: true,
  layerable: false` (`template-ref.ts:424-432`); clicks bubble to the ref;
  `toJSON` strips them. The ref itself is `editable: false, stylable:
  false` (`:341-344`). Any on-canvas override edit therefore cannot persist
  through a child (it's stripped) — it must write to the ref's
  `data-overrides` attribute. This is the binding constraint for v1.
- **Right panel already special-cases the ref** — `managers/style-
  manager.tsx:67-86`: a selected `template-ref` renders an "Edit original"
  button instead of style fields. The **v0 override form slots in right
  here** (same selection branch).
- **Trait surface** — traits render via custom React fields in
  `trait-fields/` (text, select, color, number, checkbox, button, file);
  the ref already declares a read-only `data-slug` trait
  (`template-ref.ts:360-368`, pattern 1 / per-type). Cross-type trait
  augmentation should use **pattern C (subscribe + mutate on
  `component:selected`)**, the house style per the "Toolbar extension
  reference" (§ in followups, `:545-549`) and `feedback_grapesjs_extend_
  patch_propagation.md` — pattern B (`getTypes().forEach`) misses
  `extend`-based pattern types.
- **Validation (plan 004, landed)** — `validateComponentPayload` uses
  `z.looseObject` + `z.record(z.string(), z.unknown())` for `attributes`,
  so `data-tc-binding` (template side) and `data-overrides` (page side)
  pass through untouched. **No schema change needed** (confirm in build).

## 2. Data contract

### Binding declaration (template side)

A template child is made overridable by two attributes on its component
definition:

```jsonc
{
  "tagName": "h3",
  "attributes": {
    "data-tc-binding": "card-title",      // binding name, template-scoped
    "data-tc-binding-kind": "text"        // "text" | "attribute"  (v1 set)
  },
  "components": [{ "type": "textnode", "content": "Team member" }]
}
```

- **Binding name** (`data-tc-binding`): an identifier unique within the
  template. Lookup key is `(refSlug, bindingName)` — **template-scoped, no
  global registry** (confirmed against §11's "naming conflicts" note; two
  templates may both use `card-title`).
- **Binding kind** (`data-tc-binding-kind`): **explicit, not inferred**
  (deviation from §11, which floats "implicit from component type"). Reason:
  the v0 form must know which input to render and the resolver which slot to
  write, and inferring from the GrapesJS/pattern type is brittle across
  custom pattern components. Default `"text"` when the attribute is absent.
- **v1 kinds: `text` and `attribute` only.** `rich` (replace child markup)
  is **deferred** — it's where the edit-UX cost explodes (the v0 form can't
  edit arbitrary markup; v1 in-canvas rich editing is a large surface). §11
  lists all three; this is an explicit v1-scope deviation.
- For `attribute` kind, the target attribute name rides alongside:
  `"data-tc-binding-attr": "src"` (e.g. `src` / `href` / `alt`). Constrain
  in the authoring trait so a `text` binding isn't offered on an `<img>`
  and vice-versa (§11 "validation" note).

Bindings live in the template's stored `component` (the §9 slim shape) and
serialize naturally — no `Template.data` schema change. Compatible with §13
array-rooted templates (a binding can sit on any node of any root).

### Override storage (page side)

Values are stored as a JSON string on the consuming ref's `data-overrides`,
keyed by binding name (exactly §11's shape):

```jsonc
{
  "type": "template-ref",
  "attributes": {
    "data-slug": "team-card",
    "data-overrides": "{\"card-title\":\"Alice\",\"member-photo\":\"/uploads/alice.jpg\"}"
  }
}
```

Per-kind value shape: `text` → a string (becomes the node's text content);
`attribute` → a string (the attribute value). (Reserving an object form
`{ "value": ... }` for future kinds is unnecessary in v1 — keep values flat
strings; revisit if `rich` lands.)

### Versioning / lifecycle rules (from §11)

- **Missing override** → the template's default content renders (no entry
  for a binding ⇒ leave the node as the template defines it).
- **Orphaned override** (template removed the binding) → **leave it inert**
  (recommended over strip-on-save). Justification: stripping requires the
  page editor to know the template's current binding set at save time —
  coupling the page-save path to a template read. Leaving the entry is
  cheap, harmless (the resolver simply finds no node to apply it to), and
  reversible (re-adding the binding restores the value). Revisit only if
  blob bloat is ever measured (it won't be at MVP scale).

## 3. Resolver application spec

Apply overrides **inside the `template-ref` branch**, scoped to the single
template expansion. Cleanest shape: a small pure walker invoked on the
unwrapped root *before* the generic recursion, rather than threading
override state through `resolveNode` (which also walks page content and
nested refs that must NOT see these overrides).

```ts
// inside resolveNode, template-ref branch, after `const tplRoot = unwrapTemplateRoot(rawRoot)`
const overrides = parseOverrides(node.attributes?.["data-overrides"]) // Map<string,string> | null
const bound = overrides ? applyBindings(tplRoot, overrides) : tplRoot   // pure, stops at nested refs
ctx.visiting.add(slug)
const resolved = await resolveNode(ctx, bound, depth + 1)
ctx.visiting.delete(slug)
```

`applyBindings(node, overrides)` walks `node`, and for any node carrying
`data-tc-binding` whose name is in `overrides`:

- **`text`** → replace the node's text: set `components` to a single
  `{ type: "textnode", content: value }` (and/or `content`), matching how
  pattern text children are shaped.
- **`attribute`** → merge `{ [bindingAttr]: value }` into the node's
  `attributes` (read `data-tc-binding-attr`, default by kind).

It **does not descend into nested `template-ref` nodes** — when it hits one,
it leaves it untouched (the inner ref resolves with its *own*
`data-overrides`). This realizes the v1 rule: **outer overrides don't reach
inner refs** (matches WP; §11 "nested" intent).

### Edge cases (must be covered by tests)

- **Binding on the template root** — `applyBindings` is called on `tplRoot`
  itself, so a root-level binding applies before recursion. ✔
- **Nested synced template** — binding inside an inner ref's template is
  untouched by the outer override (boundary stop above). ✔
- **Override + unresolved ref** — missing/cycle/max-depth emit a
  `placeholder()` (`templates.ts:378`) with no `data-tc-binding`, so
  overrides simply find no target and are inert. ✔ No interaction.
- **Cost** — one extra shallow walk per expanded ref, a Map check per node.
  No asymptotic change (§11 "render-time cost"). The walk is bounded by the
  same subtree `resolveNode` already traverses.

### Test list (extend the plan-001 resolver suite, `templates.test.ts`)

1. `text` override replaces a bound node's content; unbound siblings
   unchanged.
2. `attribute` override merges `src`/`href`; other attributes preserved.
3. Missing override key → template default renders.
4. Orphaned override key (no matching `data-tc-binding`) → no-op, no throw.
5. Binding on the template root node applies.
6. Outer ref's overrides do NOT reach a binding inside a nested ref.
7. Override on an unresolved ref (missing slug / forced cycle) → placeholder
   unaffected, no throw.
8. Malformed `data-overrides` JSON → treated as no overrides (parse guarded),
   template default renders.
9. Same template referenced twice with different overrides → each instance
   renders its own values (no cross-contamination; overrides are parsed
   per-ref, styles still dedupe once via `ctx.stylesAdded`).

## 4. Editor UX

### v0 — form-based (recommended to ship first; S/M)

No in-canvas editing. When a `template-ref` whose template declares
bindings is selected, the right panel shows a generated form: one field per
binding, pre-filled from `data-overrides`, writing back to the ref's
`data-overrides` attribute on change.

- **Home**: the existing selected-ref branch in
  `managers/style-manager.tsx:67-86` (which today renders only "Edit
  original"). Add an "Overrides" section above it. Alternatively a dedicated
  right-panel section — either way it keys on `selected.get("type") ===
  TEMPLATE_REF_TYPE`.
- **Discovering bindings**: add an exported `bindingsOf(body: TemplateBody):
  Binding[]` helper (walk the body's `component` for `data-tc-binding` +
  kind + attr). The plugin already holds every template body in the
  per-editor `refBodyRegistry` (`template-ref.ts:197`), so the panel reads
  bindings in-memory by slug — no fetch.
- **Fields**: reuse `trait-fields/` renderers — `text-trait-field` for
  `text`, `file-field`/`text` for an `attribute` image `src`, plain text for
  `href`. On change, read-modify-write the parsed `data-overrides` object and
  `model.addAttributes({ "data-overrides": JSON.stringify(next) })`.
- **Live preview refresh**: setting `data-overrides` won't by itself
  re-inline the §7 preview (that resolves template defaults client-side, not
  overrides). v0 accepts this — the canvas shows template defaults; the
  applied values appear in actual preview/publish render. (Closing this gap
  is a v1 concern; note it as a known v0 limitation, not a bug.)

This is vastly cheaper than in-canvas editing and fully separable. It needs
**no** changes to the locking model or `toJSON`.

### v1 — in-canvas editing (follow-up; M/L)

Double-click an overridable node inside the locked inlined preview → the
plugin intercepts → writes the edited value to the ref's `data-overrides`
→ re-inlines the preview with overrides applied. Constraints from the
current code:

- The inlined children are `locked` + stripped by `toJSON`
  (`template-ref.ts:424-457`), so the edit **must** target the ref's
  attribute, never the child (the child edit would be discarded on save).
- The §7 inline path (`init()` → `applyBindings` would need to run on the
  client too) must apply overrides when building `childDef` (`:424`) so the
  canvas reflects them — i.e. share the `applyBindings` logic between server
  resolver and client inliner.
- **Risky bits to prototype** (flag, don't pre-solve): undo/redo of an
  override edit (it's an attribute set on the ref — should ride the normal
  undo stack, unlike the `UndoManager.skip` inline append); re-inline timing
  (§7 re-render after attribute change without double-appending — reuse the
  `inlined` WeakSet guard); double-click interception vs. the existing
  click-bubbles-to-ref behavior.

### Authoring side (both versions; part of v0)

A trait on any component **inside the template editor**: "Binding name"
(text) + "Binding kind" (select: none/text/attribute) + conditional
"Attribute" (select: src/href/alt) when kind = attribute. Register via
**pattern C** — `editor.on("component:selected", cmp => cmp.set("traits",
[...existing, ...bindingTraits]))` — so it reaches `extend`-based pattern
types (cards, hero, etc.) that pattern B would miss. Gate the kind options
by component type (no `text` on `<img>`; no `src` on a heading). The trait
writes `data-tc-binding*` attributes, which serialize into the template body
naturally.

## 5. Build-plan outline

Ship v0 end-to-end first; v1 is a clean follow-up.

| # | Step | Size | Notes |
|---|------|------|-------|
| 1 | `applyBindings` + `parseOverrides` pure helpers in `templates.ts`; wire into the `resolveNode` ref branch | S | The whole render-side feature; pure + unit-testable |
| 2 | Resolver tests (the 9 cases in §3) | S | Extend `templates.test.ts` (plan 001 harness) |
| 3 | `bindingsOf(body)` helper + `Binding` type (exported from `template-ref.ts` or a sibling) | S | In-memory, reads `refBodyRegistry` |
| 4 | Authoring trait (pattern C, kind-gated) in the template editor | M | The `component:selected` augmentation + 3 trait fields |
| 5 | v0 override form in the selected-ref right-panel branch | M | Reuses `trait-fields/`; writes `data-overrides` |
| 6 | Confirm plan-004 passthrough covers `data-overrides`/`data-tc-binding` (expect no schema change) | XS | Add a passthrough test fixture |
| 7 | **v1**: shared client/server `applyBindings`; in-canvas double-click → attribute write → re-inline | M/L | Separate PR; prototype undo/re-inline first |

Verification for the build: a synced "team-card" template with a
`card-title` text binding and a `member-photo` image binding, dropped twice
on a page with different override values, renders two distinct cards in
preview/publish while a layout edit to the template still propagates to both.

## 6. Open questions

- **Orphan policy** if blob size ever matters — currently "leave inert"
  (§2); a strip-on-save would need the page editor to read the template's
  binding set. Deferred unless measured.
- **`rich` binding** fate — deferred from v1; revisit if users need
  per-instance markup (lists, multi-paragraph). Likely rides the v1
  in-canvas surface.
- **§13 array-rooted templates** — `applyBindings` must handle a root that
  is an array (`ComponentDefinition[]`); trivial (walk each), but sequence
  this after §13 lands or guard for both shapes.
- **v0 canvas fidelity** — v0 shows template defaults on the canvas, applied
  values only in real render. Acceptable for v0; closed by v1's shared
  inliner. Confirm this is an acceptable interim with the maintainer.
- **Binding-name validation** — enforce uniqueness within a template at
  authoring time? Recommend a soft check (warn on duplicate in the trait
  UI); the resolver's last-write-wins on a duplicate is harmless but
  surprising.
