// Builds the GrapesJS EditorConfig for the page-builder shell. Pure config
// assembly — no React, no lifecycle. The plugin ORDER here is load-bearing;
// see the inline notes before reordering.

import { type ProjectData, type EditorConfig } from "grapesjs"
import gjsBlocksBasic from "grapesjs-blocks-basic"
import parserPostCSS from "grapesjs-parser-postcss"
import styleBgPlugin from "grapesjs-style-bg"
import styleFilterPlugin from "grapesjs-style-filter"

import { columnsPlugin } from "@/lib/plugins/columns"
import { designSystemPlugin } from "@/lib/plugins/design-system-plugin"
import { tabsPlugin } from "@/lib/plugins/interactive"
import { patternComponents, patternsPlugin } from "@/lib/plugins/patterns"
import reactRendererPlugin from "@/lib/plugins/react-renderer"
import { rtePlugin } from "@/lib/plugins/rte"
import { tcRemoteStorage } from "@/lib/plugins/tc-storage-adapter"
import { templateRefPlugin } from "@/lib/plugins/template-ref"
import { templateBlocksPlugin } from "@/lib/plugins/template-blocks"
import { postFieldsPlugin } from "@/lib/plugins/post-fields"
import type { Template } from "@/lib/schema"

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
  "/vendor/open-props.min.css",
  "/vendor/open-props-colors-hsl.min.css",
  "/tc-normalize.css",
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
  // Skip GrapesJS' default action bar — <RteToolbar /> renders the shadcn UI
  // into the container GrapesJS still creates, positions and toggles for us.
  // The engine (execCommand + the action registry) is unchanged.
  richTextEditor: {
    custom: true,
  },
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
    // Extra rich-text actions (lists, align, indent, …) on top of the six
    // GrapesJS registers by default. Registration is deferred to `onReady`
    // inside the plugin — `RichTextEditor.add` needs the global RTE instance
    // the module builds during its own load.
    rtePlugin,
    styleFilterPlugin,
    styleBgPlugin,
  ],
  canvas: {
    styles: CANVAS_STYLE_URLS,
    customSpots: {},
  },
})
