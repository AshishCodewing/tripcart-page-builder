# Editor & UI

The editor is GrapesJS running **headless** — we hide all its default panels and
build a WordPress-style chrome in React on top, talking to GrapesJS through
`@grapesjs/react`.

## Layout

```
┌──────────────── Top Bar ─────────────────────────────────────┐
│ insert · undo/redo · layers │  title  │ device · save/publish │
├──────────┬──────────────────────────────┬────────────────────┤
│  Left    │                              │   Right            │
│  Panel   │      Canvas (iframe)         │   Panel            │
│ Blocks / │   floating toolbar + badge   │  Style / Settings  │
│ Layers   │                              │  (selected node)   │
└──────────┴──────────────────────────────┴────────────────────┘
```

- **`EditorShell`** (`editor-shell.tsx`) boots GrapesJS, configures the plugin stack
  and the Style Manager sectors, and lays out the chrome. It's the heart of the
  editor — and the best-commented file in the repo.
- **Left panel** — tabbed Blocks (the inserter) and Layers.
- **Right panel** — for the selected component: **Style** (CSS) and **Settings**
  (traits/attributes).
- **Top bar** — insert, undo/redo, layers toggle, device switching, save/publish.
- **Floating toolbar/badge** — selection chrome drawn over the canvas (move, dup,
  delete, "edit original" for template refs, convert-to-pattern).

## How React talks to GrapesJS

`@grapesjs/react` exposes the editor's headless **managers** as React providers and
hooks:

- `useEditor()` — the editor instance.
- `StylesProvider`, `TraitsProvider`, `BlocksProvider`, `SelectorsProvider`,
  `DevicesProvider` — render-prop providers that surface sectors, traits, blocks,
  CSS selectors, and devices.

The pattern everywhere: **subscribe to a GrapesJS event → set React state → render**,
and **on user input → call the GrapesJS model API** (`property.upValue`,
`trait.setValue`, `editor.select`, …) which updates the canvas and fires events back.

## The custom Style Manager

This is the biggest piece of UI. GrapesJS provides the *data* (sectors → properties);
we render each property with a bespoke React **field** instead of GrapesJS's default
inputs.

- **Sectors** are declared in `editor-shell.tsx` (`styleManager.sectors`): Layout,
  Size, Position, Spacing, Typography, Background, Border, Effects.
- A sector renders its properties; each property dispatches to a field component by
  type: color, number (+units), select, radio, gradient, composite (4-side
  margin/padding), stack (shadows/transitions), and more.
- A shared **style context** tracks layout mode (is the element flex? grid? is its
  parent flex?) so fields show/hide intelligently.

## Settings (traits)

A component's **traits** (its editable attributes/props) render in the right-panel
Settings tab via the Trait Manager, grouped into collapsible categories, one field
per trait type (text, number, select, checkbox, color, button).

## Blocks & layers

The Blocks tab lists everything draggable — basic blocks, our **patterns**, columns,
and tenant **templates** — split into Blocks vs Patterns. Drag onto the canvas, or
use the floating toolbar's insert picker to place relative to the selection.

For the file map, the field-type catalog, and the manager→field→model data flow, see
[editor-ui.technical.md](editor-ui.technical.md).
