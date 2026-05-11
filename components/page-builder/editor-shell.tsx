"use client"

import * as React from "react"
import GjsEditor, { Canvas } from "@grapesjs/react"
import { grapesjs, type Editor, type EditorConfig } from "grapesjs"
import gjsBlocksBasic from "grapesjs-blocks-basic"
import "grapesjs/dist/css/grapes.min.css"
import parserPostCSS from "grapesjs-parser-postcss"
import { columnsPlugin } from "@/lib/plugins/columns"
import { designSystemPlugin } from "@/lib/plugins/design-system-plugin"
import { patternComponents, patternsPlugin } from "@/lib/plugins/patterns"
import reactRendererPlugin from "@/lib/plugins/react-renderer"

import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import LeftPanel from "./left-panel/left-panel"
import {
  LeftPanelProvider,
  useLeftPanel,
} from "./left-panel/left-panel-context"
import RightPanel from "./right-panel/right-panel"
import TopBar from "./top-bar/top-bar"
import type { EditorContent } from "./types"
// Stylesheets the GrapesJS canvas iframe loads — produced by
// scripts/sync-vendor-css.mjs (predev / prebuild / postinstall) so the URLs
// are framework-agnostic and stable. We don't use `import "...?url"` because
// Turbopack treats CSS imports as side-effects, not URL imports. Published
// pages must also serve these files for authored content to render correctly.
const CANVAS_STYLE_URLS = [
  "/vendor/open-props-sizes.min.css",
  "/vendor/open-props-fonts.min.css",
  "/vendor/open-props-borders.min.css",
  "/vendor/open-props-colors-hsl.min.css",
]

// Per-record local-storage key. Without scoping by id, every page and post
// would share one draft and switching records would surface stale blocks
// from the previously-edited record.
const storageKeyFor = (content: EditorContent): string => {
  switch (content.kind) {
    case "page":
      return `tripcart:page-builder:page:${content.page.id}`
    case "post":
      return `tripcart:page-builder:post:${content.post.id}`
  }
}

const buildGjsOptions = (storageKey: string): EditorConfig => ({
  height: "100%",
  storageManager: {
    type: "local",
    autosave: true,
    autoload: true,
    stepsBeforeSave: 1,
    options: {
      local: { key: storageKey },
    },
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
    // Sectors drive what CSS our custom Style Manager (style-settings.tsx)
  // exposes. Strings are buildProps shorthand — GrapesJS resolves them
  // through its built-in property registry (units, options, composite
  // sub-properties, etc.). Use `{ extend: 'name', ... }` to tweak a
  // built-in, or a fully-defined object to introduce a custom property.
  styleManager: {
    sectors: [
      {
        id: "layout",
        name: "Layout",
        open: true,
        properties: [
          "display",
          // Flex container — gated to display: flex by visibility.ts.
          // Override to `radio` so RadioField picks up the icon set in
          // option-icons.ts (the GrapesJS built-in is a `select` dropdown).
          { extend: "flex-direction", type: "radio" },
          { extend: "justify-content", type: "radio" },
          { extend: "align-items", type: "radio" },
          // `gap` shorthand expanded into row-gap / column-gap so the custom
          // GapField can edit each axis independently (see gap-field.tsx).
          {
            property: "gap",
            type: "composite",
            default: "0px",
            properties: [
              { property: "row-gap",    type: "length", default: "0" },
              { property: "column-gap", type: "length", default: "0" },
            ],
          },
          "flex-wrap",
          { extend: "align-content", type: "radio" },
          // Flex child — gated to parent display: flex by visibility.ts.
          { extend: "align-self", type: "radio" },
          {
            extend: "order",
            type: "integer",
            default: "0",
          },
          // Composite that backs the Flex preset radio (Auto / Fill / Hug).
          // The preset UI lives in property-field.tsx → FlexPresetField; the
          // sub-properties below are also surfaced for power users who want
          // to type exact grow/shrink/basis values.
          {
            property: "flex",
            type: "composite",
            default: "0 0 auto",
            properties: [
              {
                property: "flex-grow",
                type: "integer",
                default: "0",
                min: 0,
              },
              {
                property: "flex-shrink",
                type: "integer",
                default: "0",
                min: 0,
              },
              { property: "flex-basis", type: "length", default: "auto" },
            ],
          },
        ],
      },
      {
        id: "size",
        name: "Size",
        open: false,
        properties: [
          { extend: "width", type: "length" },
          { extend: "height", type: "length" },
          { extend: "min-width", type: "length" },
          { extend: "min-height", type: "length" },
          { extend: "max-width", type: "length" },
          { extend: "max-height", type: "length" },
        ],
      },
      {
        id: "position",
        name: "Position",
        open: false,
        properties: [
          "position",
          { extend: "top", type: "length" },
          { extend: "right", type: "length" },
          { extend: "bottom", type: "length" },
          { extend: "left", type: "length" },
        ],
      },
      {
        id: "spacing",
        name: "Spacing",
        open: false,
        properties: [
          {
            extend: "margin",
            type: "composite",
            properties: [
              { property: "margin-top",    type: "length", default: "0" },
              { property: "margin-right",  type: "length", default: "0" },
              { property: "margin-bottom", type: "length", default: "0" },
              { property: "margin-left",   type: "length", default: "0" },
            ],
          },
          {
            extend: "padding",
            type: "composite",
            properties: [
              { property: "padding-top",    type: "length", default: "0" },
              { property: "padding-right",  type: "length", default: "0" },
              { property: "padding-bottom", type: "length", default: "0" },
              { property: "padding-left",   type: "length", default: "0" },
            ],
          },
        ],
      },
      {
        id: "typography",
        name: "Typography",
        open: false,
        properties: [
          "font-family",
          { extend: "font-size", type: "length" },
          "font-weight",
          { extend: "line-height", type: "length" },
          { extend: "letter-spacing", type: "length" },
          "color",
          "text-align",
        ],
      },
      {
        id: "background",
        name: "Background",
        open: false,
        properties: [
          "background-color",
          "background-image",
        ],
      },
      {
        id: "border",
        name: "Border",
        open: false,
        properties: [
          "border",
          {
            extend: "border-radius",
            type: "composite",
            properties: [
              { property: "border-top-left-radius",     type: "length", default: "0" },
              { property: "border-top-right-radius",    type: "length", default: "0" },
              { property: "border-bottom-right-radius", type: "length", default: "0" },
              { property: "border-bottom-left-radius",  type: "length", default: "0" },
            ],
          },
          "box-shadow",
        ],
      }
    ],
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
    (editor) => {
      editor.StyleManager.addType("length", {})
    },
    parserPostCSS,
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
    patternsPlugin,
  ],
  canvas: {
    styles: CANVAS_STYLE_URLS,
  },
})

const isDev = process.env.NODE_ENV !== "production"

function attachTracking(editor: Editor) {
  const log = (...args: unknown[]) => {
    if (isDev) console.debug("[gjs]", ...args)
  }

  editor.on("storage:start:store", () => log("store:start"))
  editor.on("storage:store", () => log("store:done"))
  editor.on("storage:error:store", (err) =>
    console.error("[gjs] store error", err)
  )

  editor.on("storage:start:load", () => log("load:start"))
  editor.on("storage:load", () => log("load:done"))
  editor.on("storage:error:load", (err) =>
    console.error("[gjs] load error", err)
  )
}

type Props = {
  /**
   * Discriminated content the shell renders chrome for. Pages and posts
   * share the canvas + left-panel + chrome; the right panel + top-bar
   * preview path branch on `kind`.
   */
  content: EditorContent
  /** Server action — already bound to (id). Receives form data on submit. */
  saveAction: (form: FormData) => Promise<void>
  /** Server action — already bound to (id). No-arg. */
  deleteAction: () => Promise<void>
}

export default function EditorShell(props: Props) {
  return (
    <LeftPanelProvider>
      <EditorShellInner {...props} />
    </LeftPanelProvider>
  )
}

function EditorShellInner({ content, saveAction, deleteAction }: Props) {
  const { open: leftOpen, setOpen: setLeftOpen } = useLeftPanel()
  const editorRef = React.useRef<Editor | null>(null)

  // Build options once per record so each page/post has its own local-storage
  // bucket and the autoload doesn't pull a previous record's draft. The
  // GjsEditor remount is forced via `key` below when the storage key changes.
  const storageKey = storageKeyFor(content)
  const gjsOptions = React.useMemo(
    () => buildGjsOptions(storageKey),
    [storageKey]
  )

  const onEditor = React.useCallback((editor: Editor) => {
    editorRef.current = editor
    if (typeof window !== "undefined") {
      ;(window as unknown as { editor: Editor }).editor = editor
    }
    attachTracking(editor)
  }, [])

  // Wrapping client action that copies the live editor state into the
  // outgoing FormData before delegating to the server action. The server
  // action persists the project JSON to the Page row; the page-preview
  // route renders that JSON via the React-renderer project module.
  const augmentedSave = React.useCallback(
    async (formData: FormData) => {
      const editor = editorRef.current
      if (editor) {
        formData.set("data", JSON.stringify(editor.getProjectData()))
      }
      await saveAction(formData)
    },
    [saveAction]
  )

  return (
    <form action={augmentedSave} className="contents">
      {/* Outer provider — controls the right (settings) sidebar. */}
      <SidebarProvider defaultOpen>
        <GjsEditor
          key={storageKey}
          className="gjs-editor-root"
          grapesjs={grapesjs}
          options={gjsOptions}
          onEditor={onEditor}
        >
          <div className="flex h-dvh flex-col">
            <TopBar content={content} />

            <div className="flex flex-1 overflow-hidden">
              {/* Inner provider — controls the left panel sidebar.
                  `contents` keeps the wrapper layout-transparent so the
                  left Sidebar and the SidebarInset participate in the
                  outer flex row alongside the right Sidebar. */}
              <SidebarProvider
                open={leftOpen}
                onOpenChange={setLeftOpen}
                className="contents"
              >
                <Sidebar
                  side="left"
                  collapsible="offcanvas"
                  className="top-12 h-[calc(100svh-3rem)]"
                >
                  <LeftPanel />
                </Sidebar>

                <SidebarInset className="bg-muted/20">
                  <Canvas className="gjs-custom-editor-canvas grow" />
                </SidebarInset>
              </SidebarProvider>

              <Sidebar
                side="right"
                collapsible="offcanvas"
                className="top-12 h-[calc(100svh-3rem)]"
              >
                <RightPanel content={content} deleteAction={deleteAction} />
              </Sidebar>
            </div>
          </div>
        </GjsEditor>
      </SidebarProvider>
    </form>
  )
}
