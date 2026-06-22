# Refactor Plan — Tier 2 (next 5 hotspots)

Second pass from `fallow health`, after the Tier 1 work (`docs/refactor-plan.md`) landed. Health moved: functions-over-threshold 128→119, critical findings 41→36, the old top hotspots (`gradient.ts`, `theme-store.ts`, `style.ts`, `template-actions.ts`) all dropped off or fell sharply.

Same conventions as Tier 1: **preserve the public API** (re-export from the original path), write characterization tests before extracting, verify with `pnpm typecheck` + `pnpm lint` + `pnpm test` per file, commit one file per change.

**Suggested order:** ① composite-field (top CRAP) → ③ page/post-actions (reuses the freshly-built `template-actions/` patterns) → ④ number-field → ② gradient-picker → ⑤ react-renderer core.

---

## ① `components/page-builder/style-fields/composite-field.tsx` — top CRAP (506)
225 LOC · cyclomatic 41 · cognitive 31 · `CompositeField` 174 LOC · fan_in 1, fan_out 6

**Driver:** a 7-branch cascading `if (name === ...)` dispatcher (margin/padding, gap, grid-template, grid-area, border-radius, overflow, flex) + 6 repeated `getProperties().find(...)` sub-property lookups + inline option extraction.

### Extractions
- **`composite-field-helpers.ts`** (pure, testable): `findSubByName(prop, name)`, `findSubBySide(prop, side)`, `extractSelectOptions(first)` (L164–169), `detectGridTemplateMode(prop, name)` (L80).
- **`composite-field-routes.ts`**: a `COMPOSITE_ROUTES` table + `routeCompositeField(property, renderProperty)` replacing the if-cascade with an O(1) name lookup.
- **Per-shape sub-components** (own files, `"use client"`): `margin-padding-field.tsx` (L32–50), `gap-field.tsx` (L52–71), `grid-template-field.tsx` (L73–102), `grid-area-field.tsx` (L104–123), `border-radius-field.tsx` (L125–158), `overflow-field.tsx` (L160–187). `FlexCompositeField` stays (small, context-coupled).
- **`composite-field.tsx`** → ~40 LOC: dispatch via `routeCompositeField`, fall back to the generic sub-property loop.

### Unit tests
`findSubByName`, `findSubBySide`, `extractSelectOptions`, `detectGridTemplateMode` — pure, mock a `PropertyComposite`.

### Risks
- One-way dep graph: helpers (types only) ← routes ← composite-field. No cycles.
- Each sub-component wraps itself in `<AllCustomField>` (preserves the style context). `"use client"` on every new `.tsx`.
- Only importer: `style-fields/property-field.tsx` — default export unchanged.

---

## ② `components/ui/gradient-picker.tsx` — largest file (840 LOC, cyclomatic 121)
59 functions · `GradientPickerTrack` 220 LOC · `GradientPicker` 148 · `GradientPickerColor` 83 · UI layer over the already-tested `lib/gradient/`

**Driver:** the stop drag/keyboard handlers inside `GradientPickerTrack` (L305–418): `onPinPointerDown/Move/Up`, `onBarPointerDown`, `onPinKeyDown` + the `DragState` machine. No gradient-math duplication found — it correctly delegates to `lib/gradient/`.

### Extractions → `components/ui/gradient-picker/` folder
**Hooks:**
- `use-stop-drag.ts` — `DragState` (L280–288), `dragRef`, the 3 pointer handlers (L305–371), `DRAG_THRESHOLD_PX`. This is the cyclomatic-121 core.
- `use-stop-keyboard.ts` — `onPinKeyDown` (L386–418), arrow/Home/End/Delete mapping, `MIN_STOPS`.
- `use-draft-value.ts` — the draft-on-edit pattern duplicated in `GradientPickerColor` (L559–564) and `GradientPickerStop` (L645–650).

**Components (own files):** `gradient-picker-pin.tsx` (pin + delete button, L448–502), `gradient-picker-track-bar.tsx` (bar + `onBarPointerDown` + `gradientCss`, L420–507), plus splitting out `root`, `track`, `flip`, `fields`, `color`, `stop`, `type`, `angle`. `types.ts` (`Ctx`, `DragState`, `GradientPickerCommitOpts`), `context.ts`, `constants.ts`, `helpers.ts`.

**`gradient-picker.tsx`** → a re-export barrel so `gradient-field.tsx`'s 8-symbol import is unchanged.

### Unit tests
`use-stop-drag` (threshold, partial vs final commit), `use-stop-keyboard` (deltas, delete-guard), `use-draft-value` (dirty tracking).

### Risks
- Pointer capture: scope `barRef` into `use-stop-drag`; validate `e.pointerId === dragRef.current.pointerId` before move/up.
- `draftStops ?? parsed.stops` (L252): `GradientPicker` must stay sole owner of `draftStops`; wrap setter in `useCallback`.
- `"use client"` on every component/hook file; `types`/`constants`/`helpers` stay server-safe.

---

## ③ `lib/cms/page-actions.ts` + `lib/cms/post-actions.ts` — DRY with Tier 1
page-actions: CRAP 420, `savePage` 73 LOC, fan_in 2 · post-actions: CRAP 240, `savePost` 51 LOC

**Clear-eyed scope** (the analysis explicitly rejected over-sharing): the `template-actions/` helpers (`dedupeSlug`, `assertSlugRenameable`) are **NOT reusable here** — pages have no slug uniqueness (path is the unique key), posts don't dedupe at create-time, and neither has template-ref usage. `validateSlug`/`buildPath` are already shared via `path.ts`. So the genuine shared surface is small but real.

### Extractions → new `lib/cms/actions-shared/` (plain modules, no `"use server"`)
- `publish-timestamp.ts` — `computePublishTimestamp(wasPublished, willBePublished, existingPublishedAt)`: the identical `willBePublished && !wasPublished ? new Date() : existing.publishedAt` in savePage (L103–104) + savePost (L68–69).
- `draft-data.ts` — `buildDraftDataUpdate(data)`: the identical `data !== undefined ? { data, draftData: Prisma.DbNull } : {}` spread (savePage L107, savePost L72).
- `parse-body.ts` — `parseOptionalProjectData(form, validate?)`: optional `data` field → `parseProjectPayload`, with an optional validate hook. page-actions passes the `projectContainsTag("main")` guard; post-actions passes none.

### Deliberately NOT extracted
The published-rename guard (3–4 lines, different error messages per entity → message ownership clearer inline); slug dedup/uniqueness; Prisma update shapes (page has parentId/path, post has excerpt); `buildPath`/`assertNotDescendant` (pages-only).

### Unit tests
`computePublishTimestamp` (4 transitions), `buildDraftDataUpdate` (2 cases), `parseOptionalProjectData` (missing/empty/valid/invalid/hook-called).

### Risks
- `"use server"` stays in the action files; helpers never touch `prisma`/`redirect`/`updateTag`. Cache-tag ordering unchanged (helpers don't move those calls).
- ~15 LOC saved — modest; the real win is shared test coverage + single source of truth for the publish/draft logic shared with future content types.

---

## ④ `components/page-builder/style-fields/number-field.tsx` — widest field reach
366 LOC · CRAP 272 · cyclomatic 75 · `NumberInput` 246 LOC · **fan_in 4 (highest among style fields)**

**Driver:** the `commit()` function (L198–231) — 9+ branches deciding empty/fixed/numeric-with-unit/numeric-no-unit value composition.

### Extractions
- **`number-field-utils.ts`** (pure): move `parseValueShape` (L34–40), `displayUnit` (L44), `varCategoriesFor` (L323–332); add `composeNumberWithUnit(shape, units, currentUnit)` (absorbs the commit branch logic) and `parseSliderValue(value, fallback)` (L120–123).
- **`number-field-hooks.ts`** (`"use client"`): `useNumberInputDraft(value, stripUnit)` (draft/lastValue state + render-phase sync, L95–113); `useNumberInputCommit(units, currentUnit, onCommit)` wrapping `composeNumberWithUnit`.
- **`number-field.tsx`** → ~160 LOC: `NumberInput` consumes the hooks; **`NumberInputProps` and the `NumberInput`/`NumberField` signatures stay byte-identical**.

### Unit tests
`parseValueShape`, `displayUnit`, `composeNumberWithUnit`, `parseSliderValue`, `varCategoriesFor` — all pure I/O pairs.

### Risks
- **Hard contract:** 4 importers (`number-trait-field`, `all-custom-field`, `property-field`, `composite-field`). Do NOT change `NumberInputProps`; only add optional props. The `all-custom-field` caller is the controlled-value/unit-change path — test undo/redo.
- Keep the shadcn Slider event handlers in-component (don't extract pointer capture). `"use client"` on hooks + utils.

---

## ⑤ react-renderer render core — `render-component.tsx` + `project/{css-composer,models}.ts`
render-component CRAP 306 (cyclomatic 40) · css-composer fallow target #1 (density 0.38, 3 deps) · models target #2 (density 0.32, 3 deps)

The React rendering layer shared by canvas + preview/public render. Highly pure → highest-leverage test target of this tier.

### Extractions
**`render-component.tsx`** → `render-component/` helpers: `resolveComponentTag()` (L107–114), `assembleChildNodes()` (L116–127), `shouldForceRemountKey()` (L163–165, RTE stability), `dispatchRenderPath()` (the 4-way EditorRender/wrapper/textnode/createElement dispatch, L138–175) — drops CC 40→~15.

**`project/css-composer.ts`** → `project/css/`: `selectors.ts` (`coerceSelectorName`, `buildSelectorString`, L52–75), `declarations.ts` (`buildStyleDeclarations` + `!important`, L78–97), `media.ts` (`partitionRulesByAtRule`, `sortMediaObject`, L122–159). `getCssAsString()` becomes a ~6-LOC orchestrator.

**`project/models.ts`** → `project/models/`: `component-mapper.ts` (`TYPE_TO_TAG_MAP`, `resolveTagName`, `normalizeClasses`), `component-node.ts` (refactored `ComponentNode`), `tree-search.ts` (`findComponentById` DFS).

Keep `project/parser.ts` re-exporting everything so the 3 dependents (RenderProject, RenderFragment, util.ts) are untouched.

### Unit tests (highest-leverage in this tier)
`resolveComponentTag`/`dispatchRenderPath`/`shouldForceRemountKey`; `coerceSelectorName`/`buildSelectorString`/`buildStyleDeclarations`/`sortMediaObject` (incl. adversarial breakpoint parsing); `resolveTagName`/`normalizeClasses`/`findComponentById`.

### Risks
- GrapesJS Component coupling (`.get()`/`.components()`/`.isInstanceOf()`) — keep those calls thin in the dispatch helpers.
- Canvas vs project render-path divergence — extract *shared* decision helpers, don't fork them.
- Enforce no cross-domain imports between `css/` and `models/` (circular-import guard). Don't add `ComponentNode` caching if canvas (mutable) adoption is planned — document the immutability contract.

---

## Carry-overs (not new files)
- `editor-shell.tsx` `EditorShellInner` (387 LOC) + `onEditor` (101) — the **deliberately deferred** `onEditor` event-wiring split from Tier 1 ③; best done with live editor smoke-testing.
- `scripts/audit-page-chrome.ts` — fallow target (cognitive 30) but a dev-only script (fan_in 0); low priority.
