"use client"

import * as React from "react"
import GjsEditor, { Canvas } from "@grapesjs/react"
import {
  grapesjs,
  type Editor,
  type EditorConfig,
  type ProjectData,
  type PropertyStack,
} from "grapesjs"
import gjsBlocksBasic from "grapesjs-blocks-basic"
import "grapesjs/dist/css/grapes.min.css"
import parserPostCSS from "grapesjs-parser-postcss"
import styleBgPlugin from "grapesjs-style-bg"
import styleFilterPlugin from "grapesjs-style-filter"
import { columnsPlugin } from "@/lib/plugins/columns"
import { CONVERT_OPEN_EVENT } from "@/lib/plugins/convert-to-template"
import { designSystemPlugin } from "@/lib/plugins/design-system-plugin"
import { patternComponents, patternsPlugin } from "@/lib/plugins/patterns"
import reactRendererPlugin from "@/lib/plugins/react-renderer"
import {
  filterProtectedStyles,
  tcRemoteStorage,
} from "@/lib/plugins/tc-storage-adapter"
import {
  TEMPLATE_REF_EDIT_EVENT,
  templateRefPlugin,
} from "@/lib/plugins/template-ref"
import { templateBlocksPlugin } from "@/lib/plugins/template-blocks"
import { useRouter } from "next/navigation"
import { Component as ComponentIcon } from "lucide-react"
import type { Component } from "grapesjs"
import type { Template } from "@/generated/prisma/client"
import { contentTenantId } from "./types"
import { ConvertTemplateDialog } from "./convert-template-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { FloatingBadge } from "./floating-badge"
import { FloatingToolbar } from "./floating-toolbar"
import { InsertBlockOverlay } from "./insert-block-overlay"
import { editorSaveStore } from "@/lib/page-builder/save-status-store"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"
import { useToastManager } from "@/components/ui/toast"
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

const buildGjsOptions = (
  initialProjectData: ProjectData,
  persistDraft: (data: ProjectData) => Promise<void>,
  templates: Template[]
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
    styleFilterPlugin,
    styleBgPlugin,
  ],
  canvas: {
    styles: CANVAS_STYLE_URLS,
    customSpots: {},
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
  /**
   * Initial canvas content, server-rendered from the record's
   * `draftData ?? data`. Seeds the editor via the `projectData` init
   * option (skips the initial storage load). Pages/posts pass the full
   * `ProjectDefinition`; templates pass the slim shape wrapped back into
   * a one-page project at the editor IO boundary.
   */
  initialProjectData: ProjectData
  /**
   * Autosave sink — a `saveEditorDraft` server action bound to
   * `(kind, id)`. The `tc-remote` storage adapter calls this (debounced)
   * on every canvas change to persist the in-progress draft to Postgres.
   */
  persistDraft: (data: ProjectData) => Promise<void>
  /** Server action — already bound to (id). Receives form data on submit. */
  saveAction: (form: FormData) => Promise<void>
  /** Server action — already bound to (id). No-arg. */
  deleteAction: () => Promise<void>
  /**
   * Tenant templates (plus visible globals) to surface as Block-Manager
   * entries — see §8 in docs/templates-followups.md. Fetched server-side
   * in the editor route. Pass `[]` for global-template editing where
   * there's no tenant context.
   */
  templates: Template[]
}

export default function EditorShell(props: Props) {
  // GrapesJS is browser-only (needs window + a canvas iframe), and the
  // surrounding Base UI primitives generate useId() values that drift
  // between server and client because parts of the tree (@grapesjs/react
  // providers, Tooltip/DropdownMenu portals) only stabilize after the
  // editor instance mounts. Defer the whole subtree to the client to
  // sidestep the hydration mismatch instead of fighting it piece-by-piece.
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <LeftPanelProvider>
      <EditorShellInner {...props} />
    </LeftPanelProvider>
  )
}

function EditorShellInner({
  content,
  tenantTheme,
  initialProjectData,
  persistDraft,
  saveAction,
  deleteAction,
  templates,
}: Props) {
  const { open: leftOpen, setOpen: setLeftOpen } = useLeftPanel()
  const editorRef = React.useRef<Editor | null>(null)
  const router = useRouter()

  // Convert-to-template UI state. The plugin fires CONVERT_OPEN_EVENT
  // with the toolbar button's screen rect; we anchor a DropdownMenu at
  // that point via an invisible trigger span. Selecting the menu item
  // closes the dropdown and opens the form dialog. The selection ref
  // is captured at menu-open time so a later canvas click can't
  // repoint the conversion mid-flow. `editorReady` is the same
  // instance held in `editorRef` but exposed as state so the dialog
  // can read it during render without tripping the refs-in-render
  // lint rule.
  const [editorReady, setEditorReady] = React.useState<Editor | null>(null)
  const [convertMenuOpen, setConvertMenuOpen] = React.useState(false)
  const [convertAnchor, setConvertAnchor] = React.useState<{
    x: number
    y: number
  } | null>(null)
  const [convertDialogOpen, setConvertDialogOpen] = React.useState(false)
  // Captured as an array — `getSelectedAll()` lets us bundle multiple
  // selected blocks into one template. Single-select is just an
  // array-of-one; the dialog wraps multi-select in a thin container at
  // save time.
  const [convertSelected, setConvertSelected] = React.useState<Component[]>([])

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

  // Branded unsaved-changes prompt for the "Edit original" jump to the
  // template editor. That navigation is a programmatic router.push fired
  // from the editor.on handler below (not a <Link>), so neither the top-bar
  // onNavigate guard nor the back/forward guard covers it — we gate the push
  // here. Reuses the same dialog as the top bar for a consistent look.
  const { confirm: confirmLeave, dialog: leaveDialog } = useConfirmDialog({
    title: "Leave with unsaved changes?",
    description:
      "Your latest edits haven't been saved yet and will be lost if you leave this page.",
    confirmText: "Leave",
    cancelText: "Stay",
    destructive: true,
  })
  // `confirmLeave` is stable, but mirror it through a ref so the stable
  // editor.on callback (registered once) always calls the live instance.
  const confirmLeaveRef = React.useRef(confirmLeave)
  React.useEffect(() => {
    confirmLeaveRef.current = confirmLeave
  }, [confirmLeave])

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

  // Keep the latest bound `persistDraft` in a ref so the debouncer's
  // identity stays stable while always calling the current action.
  const persistDraftRef = React.useRef(persistDraft)
  React.useEffect(() => {
    persistDraftRef.current = persistDraft
  }, [persistDraft])

  // Toast manager kept in a ref so the stable-identity debounce/commit
  // callbacks below can fire toasts without re-binding on every render.
  const toast = useToastManager()
  const toastRef = React.useRef(toast)
  React.useEffect(() => {
    toastRef.current = toast
  }, [toast])

  // Trailing debounce around the autosave: GrapesJS' `store` may fire
  // several times during a burst of edits (every `stepsBeforeSave`
  // changes); we collapse them into one DB write ~1s after the last
  // change. Resolves the storage `store` promise immediately so GrapesJS
  // isn't blocked on the network; the actual write is fire-and-forget
  // with errors logged (a lost <1s draft is recoverable — Publish writes
  // `data` directly). Debounce state lives in refs so the callback keeps
  // a stable identity across renders.
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const pendingDraftRef = React.useRef<ProjectData | null>(null)
  const debouncedPersist = React.useCallback(
    (data: ProjectData): Promise<void> => {
      pendingDraftRef.current = data
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null
        const payload = pendingDraftRef.current
        pendingDraftRef.current = null
        if (payload) {
          // Background draft autosave stays silent on success — it's a
          // crash-recovery net, not a user action. A failure is the only
          // thing worth interrupting for: the latest edits may be lost on
          // reload, so surface it as a toast.
          void persistDraftRef.current(payload).catch((err) => {
            console.error("[gjs] draft autosave failed", err)
            toastRef.current.add({
              type: "destructive",
              title: "Autosave failed",
              description:
                "We couldn't save your draft. Recent edits may be lost if you reload — try Save draft.",
            })
          })
        }
      }, 1000)
      return Promise.resolve()
    },
    []
  )

  // Flush a pending debounced draft on unmount / record switch so the
  // last <1s of edits isn't silently dropped when navigating away before
  // the timer fires. (Publish is unaffected — it posts fresh
  // getProjectData() directly.)
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      const payload = pendingDraftRef.current
      pendingDraftRef.current = null
      if (payload) {
        void persistDraftRef
          .current(payload)
          .catch((err) => console.error("[gjs] draft flush failed", err))
      }
    }
  }, [])

  // Build options once per record. Seeded from `initialProjectData`
  // (server-rendered draft/published content); the GjsEditor remount is
  // forced via `key={storageKey}` below when the record changes.
  const storageKey = storageKeyFor(content)

  // editorSaveStore is module-global; reset it when the edited record
  // changes so a previous record's `dirty`/autosave state can't bleed into
  // a freshly-opened one. The canvas seeds from `data` (draft cleared on
  // last commit) or an in-progress `draftData`, but either way the editor
  // starts in sync with what's persisted.
  React.useEffect(() => {
    editorSaveStore.committed()
  }, [storageKey])

  const gjsOptions = React.useMemo(
    // buildGjsOptions only stashes `debouncedPersist` in the storage
    // config; it never invokes it during render, so reading the refs it
    // closes over here is safe.
    // eslint-disable-next-line react-hooks/refs
    () => buildGjsOptions(initialProjectData, debouncedPersist, templates),
    [initialProjectData, debouncedPersist, templates]
  )

  const onEditor = React.useCallback((editor: Editor) => {
    editorRef.current = editor
    setEditorReady(editor)
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

    editor.on("update", () => editorSaveStore.markDirty())

    // Wire the "Edit template" toolbar action on `template-ref` nodes.
    // The plugin emits this event with the ref's slug; we resolve the
    // tenant via the current content, then route to a slug→id redirect
    // handler that finally lands on the canonical
    // `/admin/templates/[id]/edit` route. Reading from refs keeps the
    // closure correct without making onEditor itself re-bind on every
    // content change.
    editor.on(TEMPLATE_REF_EDIT_EVENT, ({ slug }: { slug: string }) => {
      if (!slug) return
      const go = () => {
        const tenantId = contentTenantId(contentRef.current)
        const seg = tenantId ?? "global"
        routerRef.current.push(
          `/admin/templates/by-slug/${seg}/${encodeURIComponent(slug)}`
        )
      }
      // Guard the jump: with unsaved canvas edits, confirm before leaving.
      if (!editorSaveStore.get()) {
        go()
        return
      }
      void confirmLeaveRef.current().then((leave) => {
        if (leave) go()
      })
    })

    // Open the convert-to-template dropdown next to the More toolbar
    // button. The plugin sends a rect of the clicked element so we
    // can anchor the menu via a fixed-positioned trigger.
    editor.on(
      CONVERT_OPEN_EVENT,
      ({ rect }: { rect: { x: number; y: number } | null }) => {
        if (!rect) return
        setConvertSelected(editor.getSelectedAll())
        setConvertAnchor({ x: rect.x, y: rect.y })
        setConvertMenuOpen(true)
      }
    )
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
      // Commit succeeded: `data` now matches the canvas and the server
      // cleared any pending draft, so the editor is no longer ahead.
      // (If saveAction throws, this is skipped and `dirty` stays true.)
      editorSaveStore.committed()
      // Only publishing is worth confirming — it changes what visitors
      // see. Saving a draft is low-stakes and stays quiet.
      if (formData.get("status") === "PUBLISHED") {
        toastRef.current.add({
          type: "success",
          title: "Published",
          description: "Your changes are now live.",
        })
      }
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
                  <FloatingToolbar />
                  <FloatingBadge />
                  <InsertBlockOverlay />
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

          {/* Convert-to-template dropdown anchored to the rect the
              plugin reports when its More toolbar button is clicked.
              The trigger is an invisible 0×0 element positioned fixed
              at the rect; base-ui's Positioner anchors the popup to
              it. The dialog opens once the user picks the menu item. */}
          <DropdownMenu
            open={convertMenuOpen}
            onOpenChange={setConvertMenuOpen}
          >
            {/* nativeButton={false} — the trigger here is a 0×0
                positioning anchor with pointer-events: none, not a
                user-clickable button. base-ui defaults to expecting a
                real <button> in render; we're not delivering one
                because the menu is opened programmatically from the
                CONVERT_OPEN_EVENT handler, not from a user clicking
                the trigger. */}
            <DropdownMenuTrigger
              nativeButton={false}
              render={
                <span
                  aria-hidden
                  style={{
                    position: "fixed",
                    top: convertAnchor?.y ?? 0,
                    left: convertAnchor?.x ?? 0,
                    width: 0,
                    height: 0,
                    pointerEvents: "none",
                  }}
                />
              }
            />
            <DropdownMenuContent align="start" side="bottom" sideOffset={4}>
              <DropdownMenuItem
                className="text-xs whitespace-nowrap"
                onClick={() => {
                  setConvertMenuOpen(false)
                  setConvertDialogOpen(true)
                }}
              >
                Create Pattern
                <ComponentIcon className="h-3.5 w-3.5" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ConvertTemplateDialog
            open={convertDialogOpen}
            onOpenChange={setConvertDialogOpen}
            selected={convertSelected}
            tenantId={contentTenantId(content)}
            editor={editorReady}
          />

          {/* Unsaved-changes prompt for the "Edit original" navigation. */}
          {leaveDialog}
        </GjsEditor>
      </SidebarProvider>
    </form>
  )
}
