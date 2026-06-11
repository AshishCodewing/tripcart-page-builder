# Blocks & Patterns

The draggable building blocks in the inserter. Two custom plugins provide them:
**patterns** (sections like Hero, CTA, Cards) and **columns** (a layout grid). Basic
blocks (text, link, image, video, map) come from `grapesjs-blocks-basic`.

## Patterns

A **pattern** is a ready-made section a user drags in. They live in
`lib/plugins/patterns/`, one folder per pattern, and show up under the **Patterns**
tab (marked with `data-pattern="true"`).

There are **two ways** to author a pattern:

### 1. Plain GrapesJS (HTML + CSS strings)

The pattern is a component type whose defaults are an HTML string + a CSS string.
Traits drive inline-style tweaks via listeners. No React. Examples: `about-block`,
`cards`, `testimonial-block`, `trips-block`.

```ts
editor.DomComponents.addType("about-section", {
  isComponent: el => el.classList?.contains("tc-about"),
  model: { defaults: { tagName: "section", classes: ["tc-about"],
                       styles: aboutCss, components: aboutHtml, traits: [...] } },
})
editor.Blocks.add("tc-about", { label: "About", category: "Sections",
  attributes: { "data-pattern": "true" }, content: { type: "about-section" } })
```

### 2. React-backed

The pattern is a real React component registered through the React renderer (see
[react-renderer.md](react-renderer.md)). Traits map to props; with `allowChildren`,
GrapesJS-managed editable text renders into the component's `{children}` (the
"hybrid" pattern). Example: `cta-block` / `cta-section.tsx`.

The component is added to `patternComponents` so it renders the same in the editor
and on the server.

## Choosing a style

- **Plain** when the section is mostly markup + CSS with a few knobs. Lighter, no
  React in the canvas.
- **React-backed** when you want component logic, shared UI primitives, or real
  React rendering through to publish.

## Columns

`columnsPlugin` replaces the column blocks from `grapesjs-blocks-basic` with a
Studio-SDK-style grid: `gridRow` (flex container) + `gridColumn` (flex items), with an
"Add column" trait, a "Center content" trait, and flex-basis resize. Blocks: 1/2/3
columns and a 30/70 split. We keep the basic plain blocks but swap in this richer
column behavior.

## The flat-selector rule

Every CSS rule in a pattern's `styles` string must use a **single class token** — no
descendant combinators (`.tc-card .icon` ✗). GrapesJS flattens selectors and the
Style Manager cascade breaks otherwise. For hover effects on descendants, drive a CSS
variable on the parent and read it on the child instead.

## Adding a new pattern

1. Create `lib/plugins/patterns/<name>/<name>.ts` exporting `register<Name>(editor)`.
2. Add the component type + the block (`data-pattern: "true"`, `category: "Sections"`).
3. Call it from `patterns/index.ts`'s `patternsPlugin`.
4. If React-backed: export a `ComponentConfig` and add it to `patternComponents`.

For trait↔prop wiring, the hybrid children pattern, and column internals, see
[blocks-patterns.technical.md](blocks-patterns.technical.md).
