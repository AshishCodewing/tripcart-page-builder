"use client"

import * as React from "react"
import GjsEditor, { Canvas } from "@grapesjs/react"
import {
  grapesjs,
  type Editor,
  type EditorConfig,
  type PropertyStack,
} from "grapesjs"
import gjsBlocksBasic from "grapesjs-blocks-basic"
import "grapesjs/dist/css/grapes.min.css"
import parserPostCSS from "grapesjs-parser-postcss"
import styleBgPlugin from "grapesjs-style-bg"
import styleFilterPlugin from "grapesjs-style-filter"
import { columnsPlugin } from "@/lib/plugins/columns"
import { designSystemPlugin } from "@/lib/plugins/design-system-plugin"
import { patternComponents, patternsPlugin } from "@/lib/plugins/patterns"
import reactRendererPlugin from "@/lib/plugins/react-renderer"
import {
  filterProtectedStyles,
  tcStorageAdapter,
} from "@/lib/plugins/tc-storage-adapter"
import {
  TEMPLATE_REF_EDIT_EVENT,
  templateRefPlugin,
} from "@/lib/plugins/template-ref"
import { useRouter } from "next/navigation"
import { contentTenantId } from "./types"
import { lengthProp } from "./style-fields/length-props"
import { layoutSector } from "./style-config/layout-sector"

import { useApplyThemeVars } from "@/hooks/use-apply-theme-vars"
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import type { Theme } from "@/lib/theme/schema"
import { themeStore } from "@/lib/theme/theme-store"
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
    case "template":
      return `tripcart:page-builder:template:${content.template.id}`
  }
}

// Default GrapesJS layer labels for built-in stacks (box-shadow, text-shadow,
// transition) join raw sub-property values without their units — so a fresh
// shadow renders as "0 0 0 0" even though the popover inputs show "0px 0px
// 0px 0px". `getStyleFromLayer(layer, { number: {} })` opts into unit
// composition (grapes.mjs:62942-62946) so the row label matches the inputs.
const OVERFLOW_OPTIONS = [
  { id: "visible" },
  { id: "hidden" },
  { id: "scroll" },
  { id: "auto" },
  { id: "clip" },
]

function composedLayerLabel(
  layer: Parameters<PropertyStack["getStyleFromLayer"]>[0],
  { property }: { property: PropertyStack }
): string {
  const style = property.getStyleFromLayer(layer, { number: {} })
  return String(style[property.getName()] ?? "")
}

const buildGjsOptions = (storageKey: string): EditorConfig => ({
  height: "100%",
  storageManager: {
    // `tc-local` is our custom storage type registered by tcStorageAdapter
    // — same localStorage backend as the built-in `local`, but filters
    // out CssRules marked `protected` (the tenant-wide theme rules) so
    // they don't get duplicated into every per-page project blob.
    type: "tc-local",
    autosave: true,
    autoload: true,
    stepsBeforeSave: 1,
    options: {
      // The inner `local` adapter still owns the actual write, so we
      // keep configuring it under the `local` key. tc-local delegates
      // and forwards these options through.
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
      layoutSector,
      {
        id: "size",
        name: "Size",
        open: false,
        properties: [
          lengthProp("width", { extend: "width" }),
          lengthProp("height", { extend: "height" }),
          lengthProp("min-width", { extend: "min-width" }),
          lengthProp("min-height", { extend: "min-height" }),
          lengthProp("max-width", { extend: "max-width" }),
          lengthProp("max-height", { extend: "max-height" }),
        ],
      },
      {
        id: "position",
        name: "Position",
        open: false,
        properties: [
          {
            property: "position",
            type: "select",
            default: "static",
            options: [
              { id: "static" },
              { id: "relative" },
              { id: "absolute" },
              { id: "fixed" },
              { id: "sticky" },
            ],
          },
          lengthProp("top", { extend: "top" }),
          lengthProp("right", { extend: "right" }),
          lengthProp("bottom", { extend: "bottom" }),
          lengthProp("left", { extend: "left" }),
          { extend: "z-index", type: "integer" },
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
              lengthProp("margin-top", { default: "0" }),
              lengthProp("margin-right", { default: "0" }),
              lengthProp("margin-bottom", { default: "0" }),
              lengthProp("margin-left", { default: "0" }),
            ],
          },
          {
            extend: "padding",
            type: "composite",
            properties: [
              lengthProp("padding-top", { default: "0" }),
              lengthProp("padding-right", { default: "0" }),
              lengthProp("padding-bottom", { default: "0" }),
              lengthProp("padding-left", { default: "0" }),
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
          "color",
          lengthProp("font-size", { extend: "font-size" }),
          "font-weight",
          lengthProp("line-height", { extend: "line-height" }),
          lengthProp("letter-spacing", { extend: "letter-spacing" }),
          {
            property: "font-style",
            type: "radio",
            options: [{ id: "normal" }, { id: "italic" }],
          },
          "text-align",
          {
            property: "text-transform",
            type: "radio",
            options: [
              { id: "none" },
              { id: "capitalize" },
              { id: "uppercase" },
              { id: "lowercase" },
            ],
          },
          {
            property: "text-decoration",
            type: "radio",
            options: [
              { id: "none" },
              { id: "underline" },
              { id: "overline" },
              { id: "line-through" },
            ],
          },
          {
            property: "white-space",
            type: "select",
            options: [
              { id: "normal" },
              { id: "nowrap", label: "No wrap" },
              { id: "pre" },
              { id: "pre-wrap" },
              { id: "pre-line" },
            ],
          },
          {
            property: "text-wrap",
            type: "select",
            options: [
              { id: "wrap" },
              { id: "nowrap", label: "No wrap" },
              { id: "balance" },
              { id: "pretty" },
              { id: "stable" },
            ],
          },
        ],
      },
      {
        id: "background",
        name: "Background",
        open: false,
        properties: ["background", "background-color"],
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
              lengthProp("border-top-left-radius", { default: "0" }),
              lengthProp("border-top-right-radius", { default: "0" }),
              lengthProp("border-bottom-right-radius", { default: "0" }),
              lengthProp("border-bottom-left-radius", { default: "0" }),
            ],
          },
        ],
      },
      {
        id: "effects",
        name: "Effects",
        open: false,
        properties: [
          "opacity",
          "cursor",
          { extend: "box-shadow", layerLabel: composedLayerLabel },
          { extend: "text-shadow", layerLabel: composedLayerLabel },
          "filter",
          { extend: "filter", property: "backdrop-filter" },
          { extend: "transition", layerLabel: composedLayerLabel },
          "transform",
          {
            property: "overflow",
            type: "composite",
            default: "visible",
            properties: [
              {
                property: "overflow-x",
                type: "select",
                default: "visible",
                options: OVERFLOW_OPTIONS,
              },
              {
                property: "overflow-y",
                type: "select",
                default: "visible",
                options: OVERFLOW_OPTIONS,
              },
            ],
          },
        ],
      },
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
    parserPostCSS,
    // Storage adapter registers BEFORE designSystemPlugin so the
    // `tc-local` type is known by the time autoload fires.
    tcStorageAdapter,
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
    // template-ref must register AFTER designSystemPlugin so the
    // placeholder CSS can reference --tc--preset--* vars without
    // racing the theme injection.
    templateRefPlugin,
    styleFilterPlugin,
    styleBgPlugin,
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
  /**
   * Tenant's persisted brand theme, resolved on the server from
   * `getTenantTheme(tenantId)`. Pushed into `themeStore` on mount so the
   * canvas, Style Manager, and outer chrome all render with the tenant's
   * brand instead of the bundled `defaultTheme`.
   */
  tenantTheme: Theme
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

function EditorShellInner({
  content,
  tenantTheme,
  saveAction,
  deleteAction,
}: Props) {
  const { open: leftOpen, setOpen: setLeftOpen } = useLeftPanel()
  const editorRef = React.useRef<Editor | null>(null)
  const router = useRouter()

  // Refs read from inside the editor.on callback below. The editor
  // instance is stable for one content id (storageKey forces a remount
  // when it changes), but `content` and `router` can be replaced
  // mid-mount via parent re-renders — we read the latest off the ref
  // each time the callback fires.
  const contentRef = React.useRef(content)
  const routerRef = React.useRef(router)
  React.useEffect(() => {
    contentRef.current = content
  }, [content])
  React.useEffect(() => {
    routerRef.current = router
  }, [router])

  // Bootstrap themeStore from the tenant's persisted theme before the
  // canvas hydrates. designSystemPlugin and useApplyThemeVars subscribe
  // to the store, so this single setTheme call cascades into the canvas
  // :root rule and the outer document root CSS variables.
  React.useEffect(() => {
    themeStore.setTheme(tenantTheme)
  }, [tenantTheme])

  // Mirror themeStore tokens onto the document root so
  // `var(--tc--preset--*)` resolves in the outer chrome (style-manager
  // swatches, popovers, etc.), not just inside the canvas iframe.
  useApplyThemeVars()

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
    // Override grapesjs-style-bg sub-property labels — the plugin registers
    // them as `background-repeat` / `background-position` / etc., which
    // humanize to "Background Repeat" etc. The i18n route is what the
    // plugin's own README recommends.
    editor.I18n.addMessages({
      en: {
        styleManager: {
          properties: {
            "background-repeat": "Repeat",
            "background-position": "Position",
            "background-attachment": "Attachment",
            "background-size": "Size",
          },
        },
      },
    })
    attachTracking(editor)

    // Wire the "Edit template" toolbar action on `template-ref` nodes.
    // The plugin emits this event with the ref's slug; we resolve the
    // tenant via the current content, then route to a slug→id redirect
    // handler that finally lands on the canonical
    // `/admin/templates/[id]/edit` route. Reading from refs keeps the
    // closure correct without making onEditor itself re-bind on every
    // content change.
    editor.on(TEMPLATE_REF_EDIT_EVENT, ({ slug }: { slug: string }) => {
      if (!slug) return
      const tenantId = contentTenantId(contentRef.current)
      const seg = tenantId ?? "global"
      routerRef.current.push(
        `/admin/templates/by-slug/${seg}/${encodeURIComponent(slug)}`
      )
    })
  }, [])

  // Wrapping client action that copies the live editor state into the
  // outgoing FormData before delegating to the server action. The server
  // action persists the project JSON to the Page row; the page-preview
  // route renders that JSON via the React-renderer project module.
  //
  // `filterProtectedStyles` strips theme rules (`:root` token vars and
  // the body/element/component defaults injected by designSystemPlugin)
  // before serialization, mirroring what `tc-local` does on the
  // autosave path. Without this, every publish would bake the current
  // theme snapshot into `page.data` and stale entries would win the
  // cascade over the fresh tenant theme on preview/public render.
  const augmentedSave = React.useCallback(
    async (formData: FormData) => {
      const editor = editorRef.current
      if (editor) {
        const filtered = filterProtectedStyles(editor.getProjectData())
        formData.set("data", JSON.stringify(filtered))
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
