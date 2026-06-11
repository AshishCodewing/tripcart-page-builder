# Blocks & Patterns — technical

Read [blocks-patterns.md](blocks-patterns.md) first.

## patterns/index.ts

- `patternsPlugin(editor)` — calls each `register<Name>(editor)` in sequence
  (hero, about, cta, cards, testimonial, trips, destination page, pricing page). It
  registers **blocks**, not component configs.
- `patternComponents` — the registry of **React-backed** component configs passed to
  both `reactRendererPlugin.init(...)` and the server `PagePreview`. Currently
  `{ [ctaSectionType]: ctaSectionConfig }`.
- `isPatternBlock(block)` — checks `data-pattern="true"`; used by `block-inserter`
  to split the Patterns tab from the Blocks tab.

Registration order in `editor-shell.tsx`: React renderer installs first, then
`patternsPlugin`, so the React types + the `block:add` JSX processor exist before any
`Blocks.add` runs.

## Authoring style 1 — plain (HTML/CSS strings)

Files: `about-block/about-block.ts`, `cards/cards.ts`, `testimonial-block/`,
`trips-block/`, `page-destination/`, `page-pricing/`, plus `hero-block/hero-block.tsx`
(which is plain-style but builds its children via JSX → `processReactElements`).

Pattern:
- `DomComponents.addType(type, { isComponent, model: { defaults: { tagName, classes,
  styles: css, components: html|fn, traits, ...trait defaults } }, init, methods } })`.
- `init` wires `this.on("change:<trait>", …)` to mutate inline styles
  (`addStyle`) or rebuild `components()`.
- `Blocks.add(id, { label, category: "Sections", attributes: { "data-pattern": "true" },
  activate, resetId, content: { type }, media })`.

`hero-block.tsx` is the richest example: a `heroVariant` trait rebuilds the child JSX
(`buildHeroChildren` → `processReactElements`), and `syncStyles` pushes height/align/bg
to inline styles.

## Authoring style 2 — React-backed

Files: `cta-block/cta-block.ts` (registration + `ComponentConfig`) and
`cta-block/cta-section.tsx` (the React component).

- `ctaSectionConfig: ComponentConfig = { component: CtaSection, allowChildren: true,
  props: () => [ ...traits ], model: { defaults: {...} } }`.
- `props()` traits → component props (the renderer maps them).
- `allowChildren: true` → editable GrapesJS text components (seeded in the block's
  `content.components`) render into `CtaSection`'s `{children}` — React owns the
  shell/buttons/layout, GrapesJS owns the editorial text. This is the **hybrid**
  pattern.
- Registered via `patternComponents`, so trait values flow as props identically in
  editor and server render.

Trait→prop→render: plain patterns react to trait change via `init` listeners; React
patterns just re-render with new props (no listeners needed).

## columns/index.ts

`columnsPlugin` registers:
- `gridRow` — flex container; only accepts `[data-gjs-type=gridColumn]`; vertical
  resize writes `min-height`; "Add Column" trait runs `columns:add-column`.
- `gridColumn` — flex item; only droppable into `gridRow`; "Center content" checkbox
  toggles `display:flex; align-items/justify-content: center`.
- Blocks: `column1`, `column2`, `column3`, `column3-7` (30/70 via `flex-basis`).

Replaces `grapesjs-blocks-basic`'s table/flex columns (which is why `gjsBlocksBasic`
is configured with only `["text","link","image","video","map"]`).

## Conventions

- Folder per pattern; `register<Name>(editor)` export; `tc-*` class + `tc-<name>`
  block id naming.
- **Flat selectors only**: one class token per rule (the Style Manager cascade breaks
  on descendant combinators). For descendant hover/state, set a CSS var on the parent
  and read it on the child (see `cards.ts`, `trips-block.ts`).
- Block `media` is an inline SVG thumbnail.
