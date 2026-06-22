# Refactor Plan — Top 6 Complexity Hotspots

Generated from `fallow health` (278 files, 1,880 functions). Codebase is healthy overall (maintainability 92.7, zero dead code, zero circular deps); risk is concentrated in the files below. Each plan preserves the **public API** — re-export from the original path so dependents need no import changes.

**Suggested order:** ① template-actions → ② theme-store (highest fan-in) → ③ editor-shell → then ④ gradient / ⑤ templates-table / ⑥ style.ts as capacity allows. `lib/gradient.ts` and `style.ts` are the easiest confidence-builders (pure logic, no UI).

For every file: **write characterization tests first** (capture current behavior), extract to green, then refactor internals.

---

## ① `lib/cms/template-actions.ts` — START HERE
660 LOC · CRAP 812 · fan_in 4 / fan_out 9 · `saveTemplate` cognitive 30

**File contents:** 10 server actions (`saveTemplate` L42, `createTemplate` L223, `customizeDefaultPart` L287, `customizeDefaultLayout` L337, `duplicateDefaultPart` L376, `duplicateBuiltinPattern` L431, `createTemplateFromSelection` L468, `deleteTemplate` L585, `bulkDeleteTemplates` L607, `duplicateTemplate` L625) + `CreatedTemplate` type (L201).

### Extractions
**From `saveTemplate` (L42–184):**
| Helper | Signature | Absorbs |
|---|---|---|
| `parseTemplateMetadata` | `(form, existing) → TemplateMetadata` | L47–82 |
| `validateAndResolveSlug` | `(newSlug, kind, oldSlug, tenantId) → Promise<void>` (throws) | L78–105 |
| `parseTemplateBody` | `(dataField) → SlimProject \| undefined` | L112–117 |
| `buildChromeAssignmentOps` | `(tenantId, slug, area, kind, segments) → Prisma.PrismaPromise[]` | L145–183 |

**From `createTemplateFromSelection` (L468–567):**
| Helper | Signature | Absorbs |
|---|---|---|
| `validateTemplateCreationForm` | `(form) → TemplateCreationInput` (throws) | L472–511 |
| `resolveSlugAndBuildBody` | `(baseSlug, kind, tenantId, subtree, styles) → Promise<{slug, body}>` | L513–566 |

### New layout
```
lib/cms/template-actions.ts          # ~450 LOC, thin server-action orchestrators
lib/cms/template-actions/
  metadata.ts            # parseTemplateMetadata + TemplateMetadata
  slug-validation.ts     # validateAndResolveSlug
  body-parsing.ts        # parseTemplateBody + TemplateBody
  chrome-assignment.ts   # buildChromeAssignmentOps
  creation-validation.ts # validateTemplateCreationForm + TemplateCreationInput
  slug-resolution.ts     # resolveSlugAndBuildBody
```

### Unit-testable after split
`parseTemplateMetadata`, `parseTemplateBody`, `validateTemplateCreationForm`, `buildChromeAssignmentOps` (pure); `validateAndResolveSlug`, `resolveSlugAndBuildBody` (async, mock Prisma).

### Risks
- **`"use server"` stays only in `template-actions.ts`** — helpers are plain modules; `redirect()`, `updateTag()`, and Prisma calls stay in the actions.
- **Transaction boundary:** `buildChromeAssignmentOps` returns an un-awaited `PrismaPromise[]` to feed `prisma.$transaction([...])`; building ≠ executing.
- **4 dependents unchanged** (edit page, convert-template-dialog, add-template-dialog, templates-data-table) — all symbols stay exported from the same path.

---

## ② `lib/theme/theme-store.ts` — WIDEST BLAST RADIUS
268 LOC · CRAP 552 · **fan_in 7 (highest in repo)** · `withGroup` L86 (82 LOC)

**Public API (the contract — do NOT change):** the `themeStore` object (`getSnapshot`, `getTheme`, `setTheme`, `setToken`, `detectActivePresets`, `applyPreset`, `resetTheme`, `subscribe`, `getActivePresetId`) + `ThemeSnapshot` type. Consumed by: `color-palette-grid.tsx`, `tenant-theme-editor.tsx`, `typography-grid.tsx`, `use-theme.ts`, `design-system-plugin.ts`, `editor-shell.tsx`, `use-apply-theme-vars.ts`.

### Core problem
`withGroup` (L86–167) and `getGroup` (L55–84) are parallel 12-case switches over `PresetCategory`, rebuilding `theme.settings.<group>.<field>`. Replace both with one declarative path map.

### Extractions
- **`lib/theme/token-paths.ts`** — `tokenPathMap: Record<PresetCategory, {get, set}>` (`satisfies` for exhaustiveness) + `getGroup`. Each `set` does a shallow clone preserving ref-equality of untouched branches.
- **`lib/theme/theme-mutations.ts`** — `mutateThemeGroup(theme, category, tokens)` (replaces `withGroup`), `mergePresetTokens(existing, preset)` (from `applyPreset` L232–241), `clearActiveFor(active, category)` (from L169–177).
- **`theme-store.ts`** keeps module state + `themeStore` object, delegating to the above. ~120 LOC.

### Unit-testable
Every `tokenPathMap[cat].set/get`, `mutateThemeGroup`, `mergePresetTokens`, `clearActiveFor` — all pure.

### Risks
- **CRITICAL — ref-equality:** new `set` must keep untouched subtrees referentially identical (`expect(result.settings.typography).toBe(orig.settings.typography)`) or selector hooks over-render.
- **Exhaustiveness:** `satisfies Record<PresetCategory, PathDef>` so a missing category fails at compile time.
- **No path change:** re-export `ThemeSnapshot` from `theme-store.ts`; token-paths imports types only (no cycle risk).

---

## ③ `components/page-builder/editor-shell.tsx` — THE MONOLITH
`EditorShellInner` L483 (470 LOC, largest fn in repo) · `buildGjsOptions` L116 (282) · `onEditor` L692 (101)

### A. Hooks to extract from `EditorShellInner`
| Hook | Absorbs |
|---|---|
| `useEditorInstance(seedBlockId)` | editorRef, seedBlockIdRef, editorReady state (L493–497) |
| `useEditorAutosave(persistDraft, toast)` | debounce timer/pending refs, `debouncedPersist`, `cancelPendingDraft`, unmount flush (L592–656) |
| `useEditorDraftState(content)` | storageKey + `editorSaveStore.committed()` reset (L661–670) |
| `useConvertTemplateUI()` | 4 pieces of convert menu/dialog state (L510–520) |
| `useEditorContentRefs(content, router, confirmLeave)` | contentRef/routerRef/confirmLeaveRef sync effects (L527–554) |
| `useThemeSetup(tenantTheme)` | `themeStore.setTheme` + `useApplyThemeVars` (L560–567) |

### B. Break up `buildGjsOptions` (L116–397) → `components/page-builder/editor-config/`
`storage-config.ts` (L129–140), `undo-config.ts` (L141–144), `selector-config.ts` (L145–151), `style-sectors.ts` (L159–344, one builder per sector), `plugins-config.ts` (L354–392, **preserve plugin order**), `canvas-config.ts` (L393–396), `index.ts` orchestrator (~50 LOC).

### C. Decompose `onEditor` (L692–792) → `hooks/`
- `initializeEditor(editor, opts)` — editorRef/ready, `window.editor`, i18n overrides, `attachTracking` (L693–714).
- `attachEditorEventHandlers(editor, {refs, onConvertOpen})` — `update`→markDirty (L716), `load`→seed pattern (L724–732), `load`→seed single-post (L741–752), `TEMPLATE_REF_EDIT_EVENT` (L761–778), `CONVERT_OPEN_EVENT` (L783–791).

**Target:** `EditorShellInner` drops from 470 → ~120 LOC.

### Risks
- **Effect ordering:** `useThemeSetup` must run before `GjsEditor` mounts; plugin order frozen in `useMemo`.
- **Ref/callback stability:** `onEditor` = `useCallback([], …)` reading from refs, not props; ref-sync hooks mirror props each change.
- **Remount contract:** keep `key={storageKey}` on `GjsEditor`. `"use client"` boundary stays on `EditorShell`.
- **Sequence:** extract config builders first (pure, safest) → state hooks → effect hooks → `onEditor`/events last (highest risk).

---

## ④ `lib/gradient.ts` — CHEAPEST HIGH-VALUE WIN
399 LOC · 20 functions · CRAP 420 · 7 functions over threshold · fan_in 2, fan_out 0 (pure)

**Public API (re-export from `lib/gradient/index.ts`):** types `GradientType`/`GradientStop`/`ParsedGradient`/`RadialPosition`; consts `GRADIENT_TYPES`/`RADIAL_NAMED_DIRS`/`RADIAL_POSITIONS`/`DEFAULT_GRADIENT`; fns `parseGradient`, `toGradient`, `coerceDirection`, `directionToDegrees`, `degreesToDirection`, `sampleGradientColor`, `stopPercent`, `formatPercent`, `radialPositionFromDirection`, `radialPositionToDirection`. Consumers: `gradient-picker.tsx`, `gradient-field.tsx`.

### Worst offenders → simplification
- `parseGradient` (L141, highest CRAP): split into `extractParts` / standalone `looksLikeDirection` / `parseStops`; thread `[type, direction, tokens]`.
- `directionToDegrees` (L242): table-driven — `UNIT_TO_DEG_FACTOR`, `CARDINAL_TO_DEG`, `DIAGONAL_TO_DEG`; extract `parseAngle`.
- `looksLikeDirection` (nested L159): hoist to standalone `isDirectionToken`; keyword table + single unit regex.
- `radialPositionFromDirection` (L366): normalize → `RADIAL_POSITION_SET` lookup; reverse map for 9 positions.
- `splitStopToken` (L104), `expandDirection` (L191), `fillPositions` (L130): extract sub-helpers, table-drive expansions.

### New layout
```
lib/gradient/{index,types,parse,serialize,direction,radial,color}.ts
lib/gradient/__tests__/{parse,direction,radial,color,roundtrip}.test.ts
```

### Tests (highest-leverage in the repo — all pure I/O pairs)
~320 cases: `parseGradient` (nested rgba/color-mix stops, auto-fill positions, reject <2 stops), `directionToDegrees` (deg/rad/grad/turn, cardinals, diagonals, wrapping), `radialPosition*` round-trips, `stopPercent`/`formatPercent` clamping/snapping, `parseGradient(toGradient(x))` identity.

### Risks
Low. Capture golden tests before refactor. `sampleGradientColor` is DOM-dependent but already SSR-guarded — keep isolated in `color.ts`.

---

## ⑤ `app/admin/(shell)/tenants/[id]/library/templates-data-table.tsx` — LARGEST FILE
851 LOC · cyclomatic 118 (highest) · 54 functions · `TemplatesDataTable` L115 (403) · `TemplateCard` L539 (137) · `TemplateCardActions` L677 (117)

### Extractions → new `library/templates-table/` folder
**Components to own files:** `template-card.tsx`, `template-card-actions.tsx`, `source-badge.tsx` (L519), `faceted-filter.tsx` (L795, reusable).

**`use-template-table.ts` hook** absorbs all state (sorting/filters/globalFilter/rowSelection), both `useConfirmDialog` instances, all 6 action handlers (`runDelete`/`runDuplicate`/`runCustomize`/`runDuplicateBuiltin`/`runDuplicateDefault`/`runReset` — each wraps `startTransition` + server action + `router.refresh()`), derived `selectedIds`/`selectedCount`/`hasSelectable`, `pending`. Captures `useRouter`/`useTransition` internally; returns bound callbacks + `dialog`/`resetDialog` nodes.

**`use-template-columns.ts`** — `columns` memo (L239–274) + `includesValue` (L106), `(showSynced) → ColumnDef[]`.
**`use-template-config.ts`** — `useReactTable` (L277–312) + `areaOptions` (L314–318).
**`types.ts`** — `TemplateRow` + `TemplateCard/CardActions/SourceBadge/FacetedFilter` props.

**Target:** main file 851 → ~200 LOC.

### Risks
- **TanStack `table` instance** stays in `useTemplateConfig` (return, don't clone); keep `"use no memo"` (L125) on the top-level component.
- **Callback identity:** all handlers already `useCallback`'d — preserve in the hook so the card grid doesn't re-render per-row.
- **`"use client"`** redeclared at top of each new file. Dialogs memoized to avoid multiplying on re-render.

---

## ⑥ `lib/plugins/react-renderer/style.ts` — MOST EFFICIENT (warm-up)
112 LOC but complexity density 0.40 · 3 dependents

**Public API:** `kebabToCamel`, `normalizeStyleObject`, `camelKeysToKebabStyle`, `camelToKebab` — consumed by `attrs.ts`, `process.ts`, `style.test.ts`. All stay re-exported from `style.ts`.

### Problem
`normalizeStyleObject` (L101–111) is a 4-branch dispatcher fanning into 3 multi-branch parsers (`parseStringStyle` L68–80 with JSON-try-first, `parseStyleString` L48–60, `parseStyleArray` L84–97).

### Extractions
- `style-string-parser.ts` — `parseStringStyle` + `parseStyleString` + new `parseCSSDeclaration(decl) → [k,v] | undefined`.
- `style-array-parser.ts` — `parseStyleArray` + `extractStyleEntry` + `validateStyleValue` type guard.
- `style-key-converter.ts` — `kebabKeysToCamelStyle`.
- `style.ts` keeps `camelToKebab`/`kebabToCamel` (avoid import cycle) + linear dispatcher:
```ts
export const normalizeStyleObject = (value: unknown): CSSProperties | undefined => {
  if (!value) return undefined
  if (Array.isArray(value)) return parseStyleArray(value)
  if (typeof value === "string") return parseStringStyle(value)
  if (typeof value === "object") return kebabKeysToCamelStyle(value as Record<string, unknown>)
  return undefined
}
```
Cyclomatic in main file ~6.5 → ~2.

### Risks
- **Import cycle:** keep `camelToKebab`/`kebabToCamel` in `style.ts`; helpers import from there.
- Tests import from `style.ts` — re-exports must cover all 4 symbols. Cover empty/null/`{}`/`[]`/malformed-JSON edge cases.
