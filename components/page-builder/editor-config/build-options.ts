// Builds the GrapesJS EditorConfig for the page-builder shell. Pure config
// assembly — no React, no lifecycle. The plugin ORDER here is load-bearing;
// see the inline notes before reordering.

import { type ProjectData, type EditorConfig } from "grapesjs"
import gjsBlocksBasic from "grapesjs-blocks-basic"
import parserPostCSS from "grapesjs-parser-postcss"
import styleBgPlugin from "grapesjs-style-bg"
import styleFilterPlugin from "grapesjs-style-filter"

import { buttonPlugin } from "@/lib/plugins/button"
import { columnsPlugin } from "@/lib/plugins/columns"
import { designSystemPlugin } from "@/lib/plugins/design-system-plugin"
import { tabsPlugin } from "@/lib/plugins/interactive"
import { patternComponents, patternsPlugin } from "@/lib/plugins/patterns"
import reactRendererPlugin from "@/lib/plugins/react-renderer"
import { richTextBlockPlugin, rtePlugin } from "@/lib/plugins/rte"
import { tcRemoteStorage } from "@/lib/plugins/tc-storage-adapter"
import { templateRefPlugin } from "@/lib/plugins/template-ref"
import { templateBlocksPlugin } from "@/lib/plugins/template-blocks"
import { postFieldsPlugin } from "@/lib/plugins/post-fields"
import type { Template } from "@/lib/schema"
import { CONTENT_STYLE_URLS } from "@/lib/theme/content-style-urls"

import { CANVAS_CHROME_CSS } from "./canvas-chrome-css"
import { STYLE_SECTORS } from "./style-sectors"

// Stylesheets the GrapesJS canvas iframe loads. The Open Props files are
// produced by scripts/sync-vendor-css.mjs (predev / prebuild / postinstall)
// into the gitignored /vendor/ mirror; `tc-normalize.css` is a tracked,
// hand-authored asset in public/. We don't use `import "...?url"` because
// Turbopack treats CSS imports as side-effects, not URL imports. Published
// pages must also serve these files for authored content to render correctly.
//
// Order: token definitions first (open-props + the -hsl triplets the theme
// uses), then our themed normalize floor. tc-normalize's `:where()` rules are
// specificity 0-0-0, so it sits under both the theme's :root vars (injected via
// CssComposer) and any authored styles regardless of load order.
const CANVAS_STYLE_URLS = [
  // Shared with the theme admin's style-book iframe so the two can't drift.
  ...CONTENT_STYLE_URLS,
  // prosemirror-view's base CSS (white-space: pre-wrap on `.ProseMirror`, gap
  // cursor, selected-node outline). The RTE mounts inside this iframe, so the
  // engine needs its stylesheet here — see scripts/sync-vendor-css.mjs.
  "/vendor/prosemirror.css",
]

export const buildGjsOptions = (
  initialProjectData: ProjectData,
  persistDraft: (data: ProjectData) => Promise<void>,
  templates: Template[],
  // Post-field blocks (Post Title / Featured Image / Date / Content slot) are
  // draggable only when authoring a single-post LAYOUT — see `allowPostFields`.
  options: { allowPostFields: boolean }
): EditorConfig => ({
  height: "100%",
  // The built-in component toolbar (GrapesJS' own action bar over the
  // selection) is replaced by <FloatingToolbar />. `showToolbar` is the
  // supported switch for it; ComponentView also drops the toolbar when the
  // `select` canvas spot is customized, but that path has side effects we
  // don't want — see canvas-chrome-css.ts.
  showToolbar: false,
  // Our own selection / hover outlines, injected into the frame.
  canvasCss: CANVAS_CHROME_CSS,
  // Seed the canvas from server-rendered data (`draftData ?? data`). With
  // `projectData` set, GrapesJS skips the initial storage load entirely
  // (see grapesjs Storage docs "Skip initial load").
  projectData: initialProjectData,
  storageManager: {
    // `tc-remote` autosaves the project to Postgres (`draftData`) via a
    // bound server action — see tcRemoteStorage. Protected theme rules are
    // filtered out on store so the tenant theme isn't baked into drafts.
    type: "tc-remote",
    autosave: true,
    // Initial load comes from `projectData` above, not the storage layer.
    autoload: false,
    // Coalesce a few canvas changes per store; persistDraft also debounces
    // by time so a burst collapses into one DB write.
    stepsBeforeSave: 3,
  },
  undoManager: {
    trackSelection: true,
    maximumStackLength: 500,
  },
  selectorManager: {
    componentFirst: true,
    states: [
      { name: "hover", label: "Hover" },
      { name: "focus", label: "Focused" },
    ],
  },
  styleManager: {
    sectors: STYLE_SECTORS,
  },
  // The Layers tab is our own React tree (left-panel/layers/). `custom: true`
  // stops GrapesJS from building its layer DOM *and* the sorter that drives it
  // — that sorter resolves models from jQuery `.data('model')` on `.gjs-layer`
  // rows, so it could never see a React tree. Reordering runs on @dnd-kit and
  // lands via `Component.move()`; see left-panel/layers/move-layer.ts.
  layerManager: { custom: true },
  // The RTE engine is ProseMirror, swapped in via `editor.setCustomRte(...)`
  // inside `rtePlugin`. GrapesJS renders no action bar of its own for a custom
  // RTE — <RteToolbar /> positions the shadcn UI itself over the edited node.
  // Default panels removed in favor of the WP-style React chrome.
  // The core:open-blocks / core:open-layers commands still exist; their
  // legacy panel targets are gone until React Sheets are added.
  panels: { defaults: [] },
  // reactRendererPlugin must come BEFORE patternsPlugin: it registers the
  // React component types and installs the block:add JSX→component-def
  // processor, both of which need to be in place before patternsPlugin's
  // `editor.Blocks.add(...)` calls run.
  plugins: [
    parserPostCSS,
    // Storage adapter registers BEFORE designSystemPlugin so the
    // `tc-remote` type is known by the time GrapesJS wires storage.
    // `initialProjectData` doubles as the `load()` fallback (same project
    // fed to `projectData`), so a manual reload returns real content.
    tcRemoteStorage(persistDraft, initialProjectData),
    designSystemPlugin,
    reactRendererPlugin.init({ components: patternComponents }),
    // gjsBlocksBasic ships its own column blocks (table-based by default,
    // `flexGrid: true` makes them flex). We replace those with columnsPlugin
    // — a re-implementation of the Studio SDK gridRow / gridColumn types
    // (Add-column trait, Center-content trait, flex-basis resize, …) — so
    // we keep the plain blocks (text, link, image, video, map) but get the
    // full SDK-equivalent column behavior on top.
    (editor) =>
      gjsBlocksBasic(editor, {
        blocks: ["text", "link", "image", "video", "map"],
      }),
    // Button block (`tc-button`, extends the built-in `link`). Directly after
    // gjsBlocksBasic so it lands next to Text/Link/Image in "Basic" — the
    // inserter keeps registration order — and after designSystemPlugin so
    // the theme's `.tc-element-button` rules exist alongside its own.
    buttonPlugin,
    // The opt-in Rich Text block (`rich-text` type). Registers after
    // gjsBlocksBasic so the base `text` type it extends and the "Basic" block
    // category both exist; the ProseMirror router (rtePlugin) scopes the
    // custom RTE to this type.
    richTextBlockPlugin,
    columnsPlugin,
    // Interactive web-component blocks (tc-tabs, …). After designSystemPlugin
    // so `--tc--preset--*` resolves in the type's `defaults.styles`, and after
    // reactRendererPlugin so the block-add processor is installed.
    tabsPlugin,
    patternsPlugin,
    // template-ref must register AFTER designSystemPlugin so the
    // placeholder CSS can reference --tc--preset--* vars without
    // racing the theme injection. Closes over `templates` so refs can
    // inline the referenced template's content as a locked on-canvas
    // preview (§7) without a per-ref fetch.
    templateRefPlugin(templates),
    // Register tenant templates as Block-Manager entries so they
    // become draggable from the sidebar (§8). Runs after template-ref
    // so the `template-ref` component type is known when the block
    // content `{ type: "template-ref", ... }` resolves.
    templateBlocksPlugin(templates),
    // Single-post field blocks. The four types always register (so a stored
    // `single` LAYOUT re-identifies its nodes); the draggable blocks appear
    // only when editing a LAYOUT (`allowPostFields`).
    postFieldsPlugin({ enabled: options.allowPostFields }),
    // Swaps the RTE engine for ProseMirror via `editor.setCustomRte(...)`.
    // The shadcn toolbar (<RteToolbar />) drives the live EditorView through
    // the `tc-rte:*` events this plugin emits.
    rtePlugin,
    styleFilterPlugin,
    styleBgPlugin,
  ],
  canvas: {
    styles: CANVAS_STYLE_URLS,
    // Turn off the built-in `hover` spot rendering — the `.gjs-highlighter`
    // overlay and the blue name badge — in favor of <FloatingBadge /> and the
    // `.gjs-hovered` rule in CANVAS_CHROME_CSS. GrapesJS still tracks the spot
    // and still applies the `gjs-hovered` class; only its own drawing stops.
    // `select` / `target` / `spacing` / `resize` keep their default rendering.
    customSpots: { hover: true },
  },
})
