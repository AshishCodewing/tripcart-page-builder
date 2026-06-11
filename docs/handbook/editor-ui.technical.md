# Editor & UI — technical

Read [editor-ui.md](editor-ui.md) first. Everything is under
`components/page-builder/`.

## EditorShell — `editor-shell.tsx`

The orchestrator. What it does, in order:

- **Client-defers** the whole subtree (`mounted` gate) — GrapesJS needs `window`, and
  Base UI portals cause RSC hydration drift.
- **`buildGjsOptions`** assembles the `EditorConfig`: seeds `projectData` from
  `initialProjectData` (`draftData ?? data`), sets `storageManager: { type: "tc-remote", autosave, autoload: false, stepsBeforeSave: 3 }`,
  declares the **Style Manager sectors**, and removes default panels (`panels.defaults: []`).
- **Plugin order matters** (comments explain each):
  `parserPostCSS → tcRemoteStorage → designSystemPlugin → reactRendererPlugin.init({components: patternComponents}) → gjsBlocksBasic(text/link/image/video/map) → columnsPlugin → patternsPlugin → templateRefPlugin(templates) → templateBlocksPlugin(templates) → styleFilter → styleBg`.
  React renderer **before** patterns; storage **before** design-system; template-ref
  **before** template-blocks.
- **Autosave**: `debouncedPersist` (trailing 1s) wraps the bound `persistDraft`;
  resolves the storage promise immediately (fire-and-forget, error→toast). Flushes a
  pending draft on unmount.
- **`augmentedSave`**: on publish/save, copies `filterProtectedStyles(getProjectData())`
  into the FormData, calls the bound server action, then `editorSaveStore.committed()`.
- **Theme bootstrap**: `themeStore.setTheme(tenantTheme)` + `useApplyThemeVars()`.
- Wires `TEMPLATE_REF_EDIT_EVENT` ("edit original") and `CONVERT_OPEN_EVENT`
  (convert-to-template menu).
- Remounts on record change via `key={storageKey}`.

The route (`app/admin/(editor)/.../edit/page.tsx`) loads data, binds
`savePage`/`deletePage`/`saveEditorDraft` with `.bind(null, …)`, and passes everything
in as props.

## File map

| Area | Files |
|---|---|
| Shell + types | `editor-shell.tsx`, `types.ts` (`EditorContent` discriminated union + helpers) |
| Left panel | `left-panel/{left-panel,left-panel-context,block-inserter,layers-panel}.tsx` |
| Right panel | `right-panel/right-panel.tsx`, `managers/block-settings.tsx` (Style/Settings tabs) |
| Top bar | `top-bar/{top-bar,top-bar-left,top-bar-right}.tsx` |
| Managers (provider consumers) | `managers/{style-manager,trait-manager,selector-manager,block-manager}.tsx` |
| Style fields | `style-fields/*` |
| Style config | `style-config/layout-sector.ts`, `style-fields/length-props.ts` |
| Trait fields | `trait-fields/*` |
| Canvas chrome | `floating-toolbar.tsx`, `floating-badge.tsx`, `canvas-floating.tsx`, `insert-block-picker.tsx` |
| Preview | `page-preview.tsx` (see react-renderer + preview docs) |

## Style Manager pipeline

`StylesProvider` → `style-manager.tsx` → `style-sector.tsx` (collapsible) →
`property-field.tsx` (the **type dispatcher**) → a field component.

**Field catalog** (`style-fields/`):

| Field | Type(s) | Notes |
|---|---|---|
| `number-field` | number/integer/slider | input + unit dropdown, optional slider, CSS-var picker |
| `color-field` | color | picker popover, swatches, channels |
| `select-field` / `radio-field` | select / radio | radio uses icons (e.g. rotating flex-direction) |
| `gradient-field` | gradient | Grapick stops + angle/type |
| `stack-field` | stack | layered props (box-shadow, transition) with add/remove |
| `composite-field` | composite | sub-properties (margin/padding 4-side, flex, grid) |
| `box-sides-field` | — | cross-grid for top/right/bottom/left offsets |
| `css-var-picker` | — | token dropdown over numeric inputs |
| `flex-preset-field` | — | Auto/Fill/Hug shortcuts |
| `file-field` / `all-custom-field` | file / reset | upload; initial/inherit reset |
| `base-field` | fallback | text input |

Supporting context: `property-field-context.tsx` (recursive `usePropertyRenderer` for
composites), `use-style-context.tsx` (`isFlex`/`isGrid`/`parentIsFlex`/`flexDirection`),
`visibility.ts` (gates which properties show), `property-row.tsx` (label+field layout).

**Update flow**: field calls `property.upValue(v)` → GrapesJS updates CSSOM, fires
`style:property:update` → the style context listener re-reads computed style → gated
fields re-render → canvas repaints → autosave debounce starts.

## Trait Manager

`TraitsProvider` → `trait-manager.tsx` groups by `trait.get("category")` →
`trait-field.tsx` dispatches to `{text,number,select,checkbox,color,button}-trait-field`.
Fields read `trait.getValue()` / write `trait.setValue()` (text commits on
blur/Enter).

## Blocks, layers, canvas chrome

- `BlocksProvider` → `block-manager.tsx` (2-col grid, grouped by category,
  `dragStart`/`dragStop`). `block-inserter.tsx` splits Blocks vs Patterns via
  `isPatternBlock`. `insert-block-picker.tsx` inserts relative to selection
  (before/inside-first/inside-last/after) wrapped in `UndoManager.start/stop`.
- `floating-toolbar.tsx` / `floating-badge.tsx` use `canvas-floating.tsx`
  (floating-ui + portal into `Canvas.getSpotsEl()`), mapping iframe-local rects to
  screen coords and tracking `component:update`/`canvas:update`/scroll. Actions gate
  on `draggable`/`copyable`/`removable`; template-refs get a violet accent + "edit
  original".

## Top bar

- Left: insert (toggles blocks panel), undo/redo (`UndoManager`), layers toggle,
  outline command.
- Right: `DevicesProvider` device switch; Save/Publish via `useFormStatus`; primary
  label driven by `contentStatus` + `useIsDirty()` (Publish vs Update vs Save draft).
  Templates render a plain Save (no publish lifecycle).

## Key @grapesjs/react surface

`useEditor()`/`useEditorMaybe()`, `WithEditor`, and the `*Provider` render-props
above. Property API: `getValue/hasValue/upValue/clear/getOptions/…`. Trait API:
`getValue/setValue/getType/get("category")`.
