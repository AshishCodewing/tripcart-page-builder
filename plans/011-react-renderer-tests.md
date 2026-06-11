# Plan 011: Characterization tests for the react-renderer pure modules

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ae527df..HEAD -- lib/plugins/react-renderer vitest.config.ts package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (A `vitest.config.ts` created by
> plan 001 is expected, not drift.)

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (tests only; zero source-code changes)
- **Depends on**: plans/001-verification-baseline.md (Vitest setup + `pnpm test` script)
- **Category**: tests
- **Planned at**: commit `ae527df`, 2026-06-11

## Why this matters

`lib/plugins/react-renderer/` is the module that turns saved GrapesJS project
JSON into rendered React — both in the editor canvas and on the server for
`/preview/*` routes. A separate public deployment is planned to consume the
same renderer (see `plans/009-public-render-spike.md`). Its pure modules
(attribute conversion, style parsing, CSS stringification, JSX→definition
processing) are exactly where subtle behavior lives: a focused audit on
2026-06-11 found several quirks there (lossy numeric prop coercion, silent
degradation of unregistered components, dead branch conditions). None of
those are being fixed yet — this plan pins **current behavior** down so the
later fixes, and any GrapesJS upgrade, have a safety net.

These are **characterization tests**: they assert what the code does today,
including behavior that looks wrong. Known quirks are marked in the test
cases below — write the test to pass against current behavior and add a
`// KNOWN QUIRK:` comment, do not "fix" the source.

## Current state

- **Plan 001 establishes Vitest** with `vitest.config.ts` at the repo root
  (`environment: "node"`, `include: ["lib/**/*.test.ts"]`, alias `@` → repo
  root) and scripts `"test": "vitest run"` / `"test:watch": "vitest"`. That
  include pattern already covers files under `lib/plugins/react-renderer/`.
  This plan adds **no config changes** — all new tests are plain `.test.ts`
  files (use `createElement`, not JSX, so no `.tsx` test files are needed).
- **No tests exist for the renderer.** Plan 001's scope is `lib/cms` +
  `lib/theme` only.
- Modules under test (all in `lib/plugins/react-renderer/`):
  - `style.ts` — pure. `camelToKebab`, `kebabToCamel`, `camelKeysToKebabStyle`,
    `normalizeStyleObject` (dispatches on object / string / array input).
  - `attrs.ts` — pure. `attrsToReactProps`: GrapesJS attribute bag → React
    props (case mapping, boolean-attr handling, SVG context, style parsing).
  - `react-element.ts` — pure. `isReactElement`, `getComponentConfig`.
  - `process.ts` — `processReactElements`: React element → GrapesJS component
    definition. Needs an `editor` argument; only two members are touched:
    `editor.Components.getType(type)` and
    `editor.Parser.parserHtml.splitPropsFromAttr(rest)` (see fake below).
  - `project/models.ts` — pure. `ComponentNode` (tag mapping, classes,
    attributes), `Frame`, `Page`, `Pages`, `findComponentById`.
  - `project/util.ts` — pure. `getComponentId` (React key + DOM id derivation).
  - `project/css-composer.ts` — pure. `CssComposer.getCssAsString()` and the
    helpers it calls.
  - `project/render-project.tsx` / `project/render-component.tsx` — editor-free
    React components; renderable in a node environment with
    `renderToStaticMarkup` from `react-dom/server` (React 19 is a dependency).
- Key excerpts to verify you're looking at the right code:

  `attrs.ts:193-197` (false-dropping):
  ```ts
  for (const [key, value] of Object.entries(attrs)) {
    // GrapesJS stores `false` for unset non-boolean attributes ...
    if (value === false && !BOOLEAN_HTML_ATTRS.has(key)) continue
  ```

  `project/render-component.tsx:36-43` (numeric coercion — KNOWN QUIRK):
  ```ts
  if (isReactCmp) {
    Object.keys(reactProps).forEach((k) => {
      const v = reactProps[k]
      if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) {
        reactProps[k] = Number(v)
      }
    })
  }
  ```

  `process.ts:34-45` (type resolution; unregistered function components
  yield `type: undefined` — KNOWN QUIRK):
  ```ts
  if (typeof type === "function") {
    const match = getComponentConfig(...)
    out.type = match?.type
  } else if (typeof type === "string" && editor.Components.getType(type)) {
    out.type = type
  } else if (typeof type === "string" && !isSymbolType) {
    out.tagName = type
  }
  ```

  `style.ts:64-76` (`parseStringStyle` logs `console.error` for plain
  non-declaration, non-JSON strings — KNOWN QUIRK, spy on it in tests).

- Conventions: Prettier (no semicolons, double quotes), TS strict. Model the
  test structure on the plan-001 test files (e.g.
  `lib/cms/template-shape.test.ts`) if they exist; otherwise plain
  `describe`/`it` blocks with `import { describe, expect, it, vi } from "vitest"`.
- Background reading (optional, 5 min): `docs/reference/rendering-pipeline.md` —
  explains how these modules fit the preview render path.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Install   | `pnpm install`   | exit 0              |
| Typecheck | `pnpm typecheck` | exit 0, no errors   |
| Tests     | `pnpm test`      | all pass            |
| Lint      | `pnpm lint`      | exit 0              |
| Format    | `pnpm format`    | rewrites test files to repo style |

If `generated/prisma/` is missing, run `pnpm prisma generate` once before
typechecking (needs `DATABASE_URL` in `.env`; it is not used by the tests
themselves).

## Scope

**In scope** (the only files you create/modify):
- `lib/plugins/react-renderer/style.test.ts` (create)
- `lib/plugins/react-renderer/attrs.test.ts` (create)
- `lib/plugins/react-renderer/process.test.ts` (create — also covers `react-element.ts`)
- `lib/plugins/react-renderer/project/models.test.ts` (create — also covers `util.ts`)
- `lib/plugins/react-renderer/project/css-composer.test.ts` (create)
- `lib/plugins/react-renderer/project/render.test.ts` (create)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch):
- **Any non-test file under `lib/plugins/react-renderer/`** — these are
  characterization tests. If a behavior looks like a bug, pin it and note it
  in your report.
- The canvas-side modules `render-component.tsx`, `render-root.tsx`,
  `bind.ts`, `register.ts`, `index.ts` (renderer root, not `project/`) —
  they require a live GrapesJS editor + DOM; deliberately untested here.
- `components/page-builder/page-preview.tsx` — pulls in the storage adapter;
  deferred.
- `vitest.config.ts`, `package.json`, `tsconfig.json`, `eslint.config.mjs` —
  plan 001 owns the test infrastructure.

## Git workflow

- Branch: `advisor/011-react-renderer-tests`
- Conventional commits as in `git log` (e.g.
  `test: characterize react-renderer attr and style conversion`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the Vitest baseline exists

Check that `vitest.config.ts` exists and `package.json` has a `"test"`
script. If either is missing, plan 001 has not been executed — STOP and
report (do not set up Vitest yourself; that duplicates plan 001).

**Verify**: `pnpm test` → runs (passing suite, or "no test files found" only
if 001's tests were somehow removed — that is also a STOP).

### Step 2: `style.test.ts`

Cases (each is an `it`):
- `camelToKebab`: `"backgroundColor"` → `"background-color"`;
  `"WebkitTransform"` → `"webkit-transform"`.
- `kebabToCamel`: `"font-size"` → `"fontSize"`; passthrough when no hyphen.
- `camelKeysToKebabStyle({ backgroundColor: "red", zIndex: 2 })` →
  `{ "background-color": "red", "z-index": 2 }`.
- `normalizeStyleObject` object input: `{ "font-size": "10px" }` →
  `{ fontSize: "10px" }`; non-string/number values dropped; all-dropped →
  `undefined`.
- string input, declaration list: `"color:red;font-size:12px"` →
  `{ color: "red", fontSize: "12px" }`; empty/whitespace declarations skipped.
- string input, JSON: `'{"font-size":"10px"}'` → `{ fontSize: "10px" }`.
- **KNOWN QUIRK** — string input that is neither (`"red"`): returns
  `undefined` AND calls `console.error` once. Use
  `vi.spyOn(console, "error").mockImplementation(() => {})` and assert the
  call; restore the spy.
- array input: `[{ name: "color", value: "red" }, { property: "font-size", value: 10 }]`
  → `{ color: "red", fontSize: 10 }`; entries with empty name, `undefined`
  or `""` value, or non-string/number value are skipped.
- falsy input (`null`, `""`, `undefined`) → `undefined`.

**Verify**: `pnpm test style` → this file passes.

### Step 3: `attrs.test.ts`

Cases for `attrsToReactProps`:
- `{ class: "a b", for: "x" }` → `{ className: "a b", htmlFor: "x" }`.
- false-dropping: `{ target: false }` → `{}` (omitted);
  `{ disabled: false }` → `{ disabled: false }` (kept — boolean HTML attr).
- `{ style: "color:red" }` → `{ style: { color: "red" } }`.
- `data-*` passthrough: `{ "data-foo": "1" }` → unchanged key.
- ATTR_CASE_MAP: `{ "stroke-width": "2", tabindex: "0" }` →
  `{ strokeWidth: "2", tabIndex: "0" }`.
- SVG context: `{ viewBox: "0 0 10 10", "clip-path": "url(#c)" }` — presence
  of `viewBox` flips SVG mode → `{ viewBox: ..., clipPath: ... }`. Also: a
  bag with `d` (`{ d: "M0 0" }`) flips it; per-prop SVG names (`{ cx: "5" }`)
  camelize even without context.
- **KNOWN QUIRK** — `{ "aria-label": "hi" }` → key stays `"aria-label"`
  (it reaches the unknown-attribute fallback because the camelized form
  `"ariaLabel"` matches none of the checks; the `camel.startsWith("aria-")`
  branch is unreachable). Assert the original key is preserved.
- unknown attribute keeps original key: `{ "my-attr": "v" }` → `{ "my-attr": "v" }`.
- standard prop passthrough: `{ href: "/x", id: "y" }` → unchanged.

**Verify**: `pnpm test attrs` → passes.

### Step 4: `process.test.ts`

Build elements with `createElement` from `"react"` (no JSX). Use this fake
editor (cast `as unknown as Editor`):

```ts
const makeEditor = (knownTypes: string[] = []) =>
  ({
    Components: {
      getType: (t: string) => (knownTypes.includes(t) ? { id: t } : undefined),
    },
    Parser: {
      parserHtml: {
        // mirrors the shape the real GrapesJS helper returns; for these
        // tests everything lands in attrs
        splitPropsFromAttr: (rest: Record<string, unknown>) => ({
          attrs: { ...rest },
          props: {},
        }),
      },
    },
  }) as unknown as Editor
```

Cases:
- `isReactElement`: a `createElement("div")` result → true; `null`, `"x"`,
  `{}`, `{ $$typeof: Symbol("x") }` (no props) → false.
- `getComponentConfig`: finds entry by component identity; returns
  `undefined` for an unknown component.
- intrinsic tag: `createElement("section", { className: "hero", style: { backgroundColor: "red" }, id: "x" }, "Hello")`
  → `{ tagName: "section", classes: "hero", style: { "background-color": "red" }, attributes: { id: "x" }, components: [{ type: "textnode", content: "Hello" }] }`.
- registered GrapesJS type: with `makeEditor(["text"])`,
  `createElement("text" as never)` → `out.type === "text"`, no `tagName`.
- registered React component: `config = { components: { MyHero: { component: MyHero } } }`
  → `out.type === "MyHero"`.
- **KNOWN QUIRK** — unregistered function component: `out.type` is
  `undefined` and no `tagName` is set (the element silently degrades; no
  warning). Assert `"type" in out && out.type === undefined`.
- **KNOWN QUIRK** — `createElement(Fragment, null, createElement("div"))`:
  neither `type` nor `tagName` on the result (a default `div` component will
  materialize downstream, so Fragments are *not* transparent), children
  still processed (`components` has 1 entry).
- children coercion: single string child → one textnode; mixed array
  `["a", element, null, 42]` → textnode + processed element only (non-string,
  non-element entries dropped).
- non-element input returns `undefined`: `processReactElements({ model: "hi", editor, config: {} })`.

**Verify**: `pnpm test process` → passes.

### Step 5: `project/models.test.ts`

Cases:
- `ComponentNode` tag mapping: `{ type: "image" }` → `tagName "img"`,
  `isVoid === true`; `{ type: "wrapper" }` → `"body"`; `{ type: "link" }` →
  `"a"`; `{ type: "head" }` → `"head"`; `{ tagName: "section" }` (no type) →
  `"section"`, `type === "default"`; `{}` → `tagName ""`.
- `classes`: `{ classes: ["a", { name: "b" }] }` → `["a", "b"]`; reflected
  into `attributes.class` as `"a b"`.
- `attributes`: id comes from `attributes.id` (top-level `id` is ignored);
  when absent, `attributes.id` is `undefined`.
- `head` fallback: node without `head` → `head.tagName === "head"`.
- `findComponentById`: finds a nested node by `attributes.id`; returns
  `null` when absent.
- `getComponentId` (from `util.ts`): explicit id → `key === id`,
  `nodeId === id`; no id with `parentId: "p", index: 2` → `key "p-2"`,
  `nodeId undefined`; no id/parent, `type "head"` → `"gjs-head"`; no
  id/parent otherwise → `` `gjs-${type}` ``.

**Verify**: `pnpm test models` → passes.

### Step 6: `project/css-composer.test.ts`

Cases for `new CssComposer(rules).getCssAsString()`:
- plain rule: `{ selectors: ["a"], style: { color: "red" } }` →
  `".a{color:red;}"`.
- multiple selectors join with no separator (compound):
  `["a", "b"]` → `".a.b{...}"`.
- selector shapes: object `{ name: "x" }` and pre-prefixed `"#id"` / `".x"`
  pass through `getFromSelectorName` (bare → `.x`, `#`/`.` preserved).
- `state: "hover"` → `".a:hover{...}"`.
- `selectorsAdd: "#raw > .child"` → appended after a comma.
- `important: true` → every declaration gets ` !important`;
  `important: ["color"]` → only that property.
- `__`-prefixed style keys skipped; array style values emit one declaration
  per value.
- media grouping: two rules with `mediaText: "(min-width: 480px)"` /
  `"(min-width: 768px)"` → two `@media` blocks, 480 before 768 (both
  min-width sorts ascending); a pair of `max-width` queries sorts
  **descending** (e.g. 991 before 479).
- `atRuleType: "font-face"` + `singleAtRule: true` → `"@font-face{...}"`
  with bare declarations (no selector braces).
- empty rules array → `""`.

**Verify**: `pnpm test css-composer` → passes.

### Step 7: `project/render.test.ts` — end-to-end JSON → HTML

Use `renderToStaticMarkup` from `"react-dom/server"` and `createElement`.
Assert with `toContain` on substrings, not full-document equality (head/body
internals are noisy).

Fixture sketch:

```ts
const project = {
  styles: [{ selectors: ["a"], style: { color: "red" } }],
  pages: [
    {
      id: "home",
      frames: [
        {
          component: {
            type: "wrapper",
            components: [
              {
                tagName: "section",
                attributes: { id: "s1", class: "hero" },
                components: [{ type: "textnode", content: "Hello" }],
              },
            ],
          },
        },
      ],
    },
  ],
}
```

Cases:
- `RenderProject({ projectData: project })` markup contains
  `<section` with `class="hero"` and `id="s1"`, the text `Hello`, and a
  `<style>` whose content includes `.a{color:red;}`.
- **CSS is not escaped**: add a rule whose selector stringifies with
  `selectorsAdd: ".a > .b"` → markup contains `.a > .b` literally (verified
  against React 19 on 2026-06-11: text children of `<style>` render raw).
- error paths: `projectData: {}` → contains `Error: noPagesFound`;
  unknown `pageId` → `Error: pageNotFound`; page with `frames: []` →
  `Error: noFramesFound`; `componentId: "nope"` → `Error: componentNotFound`.
- `componentId` subtree render: `componentId: "s1"` → markup contains the
  section but no `<html`.
- registered React component: config
  `{ components: { "price-tag": { component: PriceTag } } }` where

  ```ts
  const PriceTag = (props: { zip?: unknown; children?: ReactNode }) =>
    createElement("span", null, `${typeof props.zip}:${String(props.zip)}`)
  ```

  and a node `{ type: "price-tag", attributes: { zip: "01234" } }`:
  - **KNOWN QUIRK** — markup contains `number:1234` (numeric-looking string
    props are coerced to numbers for registered components; leading zero is
    lost). A non-numeric string (`zip: "ab1"`) stays a string.
- `type: "image"` node renders `<img` and is void (no children rendered).
- textnode content renders escaped by React (e.g. content `"<b>x</b>"`
  appears as `&lt;b&gt;x&lt;/b&gt;` — pin it: stored HTML in `content` is
  NOT interpreted).

**Verify**: `pnpm test render` → passes.

### Step 8: Full gate + index update

Run the full suite, typecheck, lint, format. Update the plan-011 row in
`plans/README.md` to DONE.

**Verify**: `pnpm test && pnpm typecheck && pnpm lint` → all exit 0.

## Test plan

This plan IS the test plan; the case lists in steps 2–7 are the required
minimum (~45 assertions across 6 files). Structure: `describe` per exported
function/class, `it` per case, following the plan-001 test files if present.

## Done criteria

ALL must hold:

- [ ] Six new test files exist at the paths in "Scope"; `pnpm test` exits 0.
- [ ] Every case marked **KNOWN QUIRK** above is present and carries a
      `// KNOWN QUIRK:` comment in the test file.
- [ ] `pnpm typecheck` exits 0; `pnpm lint` exits 0.
- [ ] `git status` shows no modified files under `lib/plugins/react-renderer/`
      other than new `*.test.ts` files (no source edits).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `vitest.config.ts` or the `test` script is missing (plan 001 not executed).
- Any "Current state" excerpt doesn't match the live code (module drifted).
- A characterization assertion fails in a way that suggests the documented
  behavior above is wrong — report the actual behavior; do not change the
  source to make the test pass, and do not silently invert the assertion
  without flagging it in your report.
- You find yourself wanting to import `grapesjs` (the runtime, not just its
  types) in a test — the pure modules don't need it; that signals a wrong
  approach.

## Maintenance notes

- **Quirk-pinning tests are tripwires, not endorsements.** The 2026-06-11
  focused audit left these findings unplanned (recorded in
  `plans/README.md`): lossy numeric prop coercion
  (`project/render-component.tsx:36-43`), silent unregistered-component
  degradation and non-transparent Fragments (`process.ts:34-46`),
  `isComponent` case mismatch (`register.ts:61`), raw `view.el` rebinding
  (`bind.ts:83`), and small-debt items in `attrs.ts`/`style.ts`. When any of
  those is fixed, the corresponding KNOWN QUIRK test must be updated in the
  same PR — that's the point.
- The render e2e tests double as a contract for the planned public render
  deployment (plan 009). If plan 009's spike changes the renderer's output
  shape, these tests are the first thing to update.
- Canvas-side modules (`bind.ts`, `register.ts`, `render-root.tsx`, root
  `render-component.tsx`) remain untested — they need a GrapesJS editor +
  jsdom harness. Deferred deliberately; revisit if a GrapesJS upgrade is
  planned (see the rejected-upgrades note in `plans/README.md`).
