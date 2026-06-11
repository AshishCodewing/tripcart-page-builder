# React Renderer

The bridge between GrapesJS's JSON and React. This is the most important module to
understand — it's why our blocks can be real React components.

## The problem it solves

GrapesJS represents a document as a JSON tree of components. We want two things from
that tree:

1. In the editor, render it **live and interactive** while GrapesJS owns the models.
2. On the server, render it to a **plain React tree** for preview/publish — without
   loading GrapesJS at all.

The React Renderer does both, and lets you register your own React components as
GrapesJS component *types* so a `<HeroSection>` round-trips as a real component.

## Two halves

The module is split in two — this distinction is the key to the whole thing:

| Half | Path | Runs where | Job |
|---|---|---|---|
| **Editor plugin** | `lib/plugins/react-renderer/` (top level) | Browser, inside GrapesJS | Register React component types; render the canvas; convert JSX blocks to GrapesJS definitions |
| **Project renderer** | `lib/plugins/react-renderer/project/` | Server (RSC) | Read saved JSON → emit a React tree, no GrapesJS runtime |

They share the JSON format but are otherwise independent. The project renderer has
**zero** dependency on GrapesJS or the browser, which is what lets published pages be
ordinary server components.

## How you use it

In `EditorShell`, the plugin is initialized with a registry of components:

```ts
reactRendererPlugin.init({ components: patternComponents })
```

Each entry maps a type name to a React component plus config (does it accept
children? which traits does it expose? can it be styled?). Once registered:

- The component appears in the canvas as itself, rendered by React.
- Blocks can use JSX as their content; the plugin converts that JSX into a GrapesJS
  component definition automatically.
- The **same** `patternComponents` registry is passed to the server renderer
  (`PagePreview`), so the component renders identically on preview/publish.

## What "register a React component type" buys you

- **Custom rendering** in editor and server (your JSX, not a generic div).
- **Traits → props**: traits you declare show up in the right-panel Settings and flow
  to the component as props.
- **Children slots**: with `allowChildren`, GrapesJS-managed children (e.g. editable
  text) render into your component's `{children}`. This is the "hybrid" pattern —
  React owns the shell, GrapesJS owns the editable content inside.

## The mental model

- **Editor side**: GrapesJS model ⇄ React. React renders the DOM; a binding layer
  hands that DOM back to GrapesJS's view so selection/drag still work. Edits to the
  model trigger targeted React re-renders.
- **Server side**: JSON in → walk the tree → `createElement` for each node, mapping
  `type` to a registered React component or a plain HTML tag → React out. CSS rules
  are stringified and inlined.

For the file-by-file breakdown, the JSX→definition conversion, attribute/style
mapping, and the gotchas, see
[react-renderer.technical.md](react-renderer.technical.md).
