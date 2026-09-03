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

## button/index.ts

`buttonPlugin` registers the `tc-button` type (extends the built-in `link`, renders as
`<a>`) and a "Button" block in "Basic". It follows WordPress's split:

- **Structure in the plugin.** `defaults.styles` holds display/padding/font/cursor/focus
  rules, all in `:where(.tc-button)` (specificity 0-0-0).
- **Look in the theme.** The block wears `.tc-element-button` (WP's `.wp-element-button`),
  the only selector `styles.elements.button` targets — never the bare `button` tag, so
  tab buttons and toggles keep their own CSS. Colors, radius, border and text-decoration
  come from there. Any block that should look like a call to action wears the badge.
- **Variants are theme-defined.** The `variant` select trait (`changeProp`) only toggles
  `is-style-outline`; `elements.button.variations.outline` in the theme supplies the CSS
  (`lib/tokens/index.ts`). Fill is the unclassed default.
- `init` re-adds both identity classes: parsed HTML replaces the default class list
  wholesale (GrapesJS `initClasses`), so `<a class="tc-button">` alone must still resolve.

## Conventions

- Folder per pattern; `register<Name>(editor)` export; `tc-*` class + `tc-<name>`
  block id naming.
- **Flat selectors only**: one class token per rule (the Style Manager cascade breaks
  on descendant combinators). For descendant hover/state, set a CSS var on the parent
  and read it on the child (see `cards.ts`, `trips-block.ts`).
- Block `media` is an inline SVG thumbnail.
- **Themeable parts → declare a `StyleSurface`.** A block whose controls a tenant should be
  able to restyle from the theme (tabs, accordion, dropdown) ships a pure-data
  `<block>.surface.ts` next to the plugin (no GrapesJS import — the theme compiler runs it
  server-side) and lists it in `STYLE_SURFACES` (`lib/theme/style-surfaces.ts`). Each part
  names a stable selector (roles/attributes, never author classes, real specificity so it
  beats the plugin's `:where()` defaults), the style groups it accepts, and the state
  suffixes it allows. Leave layout out of `supports` — a theme must not be able to break the
  block's behaviour. Model: `lib/plugins/interactive/tabs.surface.ts`.
