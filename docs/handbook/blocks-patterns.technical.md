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

## heading/index.ts

`headingPlugin` registers the `tc-heading` type (extends the built-in `text`) and a
"Heading" block in "Basic". The level is a component property, not a separate block:

- **`level` (1-6) is the source of truth**, `tagName` is derived from it. A
  `change:level` listener writes `h${level}`, which makes GrapesJS re-render the node
  (`Component.tagUpdated` → `rerender`). The select trait writes the option id, a
  string, so `syncTagName` coerces `level` back to a number before saving.
- **No CSS of its own.** `styles.elements.heading` in the theme already compiles to
  `h1, h2, …, h6` (`lib/theme/style-selectors.ts`), so a heading picks up the tenant's
  type scale for free.
- **`isComponent` requires the `.tc-heading` marker class**, like the Button block, so
  plain `<h2>`s inside patterns keep the behavior they have today.
- `setHeadingLevel(editor, component, level)` is the entry point for changing the level
  from outside the Trait Manager (the RTE toolbar uses it). While the heading is being
  edited the element carries a live ProseMirror view, so it ends the edit session, waits
  for `rte:disable` (GrapesJS syncs the edited content back during that pass), applies
  the level, and hands editing to whichever view the re-render produces — the re-render
  is asynchronous and builds a _fresh_ `ComponentView`, so re-activating the view you
  already hold does nothing.

## animation/index.ts, animation/sector.ts

`animationPlugin` registers `tc-animation` (a plain `div` wrapper),
`tc-animation-group` (only accepts `[data-gjs-type=tc-animation]`) and
`tc-animation-frame`, plus a block for each of the first two in the "Animation"
category. It is modeled on the Studio SDK's
`animationComponent`, but CSS only: scroll-driven animations instead of an
IntersectionObserver `script`.

- **Real CSS on the component's rule**, written by the "Animation" sector
  (`ANIMATION_SECTOR`, last in `STYLE_SECTORS`): `animation-name` (Open Props
  keyframes), `-timing-function` (Open Props easings), `-range-start/-end`,
  `-timeline`, `-fill-mode`, `-iteration-count`, `-direction`. The block drops with
  `animation-timeline: view()`, `entry 0%` → `cover 30%`.
- **One composite per multi-part value, drawn as one boxed group.** Start and End are
  phase + offset composites over `animation-range-start/-end`. Timeline composes every
  `animation-timeline` form, `view(<axis> <inset-start> <inset-end>)`,
  `scroll(<nearest|root|self> <axis>)`, `auto` and `none`, omitting defaults
  (`composeTimeline` / `parseTimeline`).
- **Visibility is the GrapesJS `isVisible` property option.** GrapesJS hides a sector
  with no visible property (`StyleManager.__upProps`), and `filterSectorProperties`
  honors `property.isVisible()` so our panel does too. Timeline and range hide on an
  Animation inside a group.
- **Advanced fold.** An `advanced: true` declaration (`style-fields/property-hints.ts`)
  renders inside the sector's full-width "Advanced" collapsible, in declaration order.
- **Composite gotchas.** `getStyleFromProps` blanks every part's name *after* `toStyle`
  runs, so a part must never share a name with a property `toStyle` writes. And
  `fromStyle` only runs when the rule declares the composite's name or a part's name
  (`__styleHasProps`). The group's Timeline composite is therefore named
  `view-timeline-axis`, with parts `view-timeline-part-*`, and always writes the axis,
  so an inset alone still reads back.
- **Groups are a CSS-variable bridge.** `.tc-animation-group` declares
  `view-timeline-name: --tc-animation-group` and the defaults for
  `--tc-animation-range-*-name/-offset` and `--tc-animation-stagger`. Author values
  land on the group's id rule and win. A nested group re-declares them instead of
  inheriting the outer group's. The group's Timeline composite writes the real
  `view-timeline-axis` / `view-timeline-inset` on the group. Each child wears `tc-animation--grouped` (synced on the
  group's `add`/`remove`), whose rule sets `animation-timeline: --tc-animation-group`
  and ranges pushed later by `(sibling-index() - 1) * var(--tc-animation-stagger)`. The
  group's Start/End are a `detached` composite writing those custom properties. Joining
  a group strips the child's own timeline and range. Single class tokens throughout;
  see the flat-selector rule.
- **Frame.** Both blocks drop as `tc-animation-frame` > Animation (or > group). The
  frame is `overflow-x: clip`: a slide keyframe starts a full element width to one side,
  and a transformed box still counts toward the page's scrollable overflow. It's `clip`
  rather than `hidden` because `hidden` makes the frame a scroll container, and a view
  timeline inside would follow a box that never scrolls. A group is framed whole,
  because framing each child would make `sibling-index()` 1 for every child. The blocks
  drop without `select: true`; a `block:drag:stop` listener selects what the frame
  holds, where the Animation sector applies.
- **Keyframes.** `tc-fade-in` stands in for Open Props' `fade-in`, which only declares
  `to` and so animates `opacity` 1 → 1. Exits (`fade-out`, `slide-out-*`) and `ping`
  are not offered: they end hidden.
- **Fallbacks.** `@media (prefers-reduced-motion: reduce)` sets `animation: none
  !important`. No `@supports` rule: a browser without scroll timelines runs the
  animation with no duration and shows its final frame, which for every offered
  keyframe is the content in place. (An `@supports` rule would also have to dodge two
  GrapesJS 0.22 bugs: `grapesjs-parser-postcss` only nests `@media`/`@keyframes`, and
  `Css.setRule(…, { atRuleType })` emits `@media`.)
- Keyframe names resolve against `open-props.min.css`, so any surface rendering
  authored content must load it (`CONTENT_STYLE_URLS`).

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
  beats the plugin's `:where()` defaults) and the state suffixes it allows. Every style
  group is offered by default; narrow `supports` only where a group would genuinely break
  the block, never on taste. Model: `lib/plugins/interactive/tabs.surface.ts`.
