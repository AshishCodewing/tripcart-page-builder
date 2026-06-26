"use client"

import * as React from "react"
import GjsEditor, { Canvas } from "@grapesjs/react"
import {
  grapesjs,
  type Component,
  type ComponentDefinition,
  type Editor,
  type ProjectData,
} from "grapesjs"
import "grapesjs/dist/css/grapes.min.css"
import { CONVERT_OPEN_EVENT } from "@/lib/plugins/convert-to-template"
import { filterProtectedStyles } from "@/lib/plugins/tc-storage-adapter"
import { TEMPLATE_REF_EDIT_EVENT } from "@/lib/plugins/template-ref"
import { DEFAULT_SINGLE_POST_SEED } from "@/lib/plugins/post-fields"
import { useRouter } from "next/navigation"
import { Component as ComponentIcon } from "lucide-react"
import type { Template } from "@/generated/prisma/client"
import { contentTenantId } from "./types"
import { ConvertTemplateDialog } from "./convert-template-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { useApplyThemeVars } from "@/hooks/use-apply-theme-vars"
import { useIsClient } from "@/hooks/use-is-client"
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
import { ContentSlotDeleteGuard } from "./content-slot-delete-guard"
import { editorSaveStore } from "@/lib/page-builder/save-status-store"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"
import { useToastManager } from "@/components/ui/toast"
import { buildGjsOptions } from "./editor-config/build-options"
import { useEditorAutosave } from "./hooks/use-editor-autosave"
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
   * entries — see §8 in docs/reference/templates-followups.md. Fetched server-side
   * in the editor route. Pass `[]` for global-template editing where
   * there's no tenant context.
   */
  templates: Template[]
  /**
   * Built-in pattern block id to insert once on load (set via `?seed=` by
   * `duplicateBuiltinPattern`). Lets a blank tenant pattern capture a built-in
   * pattern's content — which only exists editor-side. Only seeds when the
   * canvas is empty, so reloading the seeded URL won't double-insert.
   */
  seedBlockId?: string
}

export default function EditorShell(props: Props) {
  // GrapesJS is browser-only (needs window + a canvas iframe), and the
  // surrounding Base UI primitives generate useId() values that drift
  // between server and client because parts of the tree (@grapesjs/react
  // providers, Tooltip/DropdownMenu portals) only stabilize after the
  // editor instance mounts. Defer the whole subtree to the client to
  // sidestep the hydration mismatch instead of fighting it piece-by-piece.
  if (!useIsClient()) return null

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
  seedBlockId,
}: Props) {
  const { open: leftOpen, setOpen: setLeftOpen } = useLeftPanel()
  const editorRef = React.useRef<Editor | null>(null)
  // Stable for the mount (derived from `?seed=`); read inside the `[]`-dep
  // `onEditor` callback via a ref, matching the other refs read there.
  const seedBlockIdRef = React.useRef(seedBlockId)
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

  // Autosave debounce around the bound persistDraft — owns its own debounce
  // timer, unmount flush, and failure toast (see useEditorAutosave).
  const { debouncedPersist, cancelPendingDraft } =
    useEditorAutosave(persistDraft)

  // Toast manager kept in a ref so the stable-identity commit callback below
  // can fire the Publish toast without re-binding on every render.
  const toast = useToastManager()
  const toastRef = React.useRef(toast)
  React.useEffect(() => {
    toastRef.current = toast
  }, [toast])

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

  // Post-field blocks belong only in a single-post LAYOUT editor — page,
  // post, pattern, and part editors never expose them.
  const allowPostFields =
    content.kind === "template" && content.template.kind === "LAYOUT"

  const gjsOptions = React.useMemo(
    () =>
      buildGjsOptions(initialProjectData, debouncedPersist, templates, {
        allowPostFields,
      }),
    [initialProjectData, debouncedPersist, templates, allowPostFields]
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

    // Seed a built-in pattern's content into a freshly-duplicated blank
    // pattern (see `duplicateBuiltinPattern`). Built-in block content is only
    // available editor-side, so we insert it here on load. Guard on an empty
    // canvas so reloading the `?seed=` URL after the copy has content is a
    // no-op (no double-insert). Appending fires `update` → markDirty →
    // autosave persists the captured tree (+ the block's CSS).
    editor.on("load", () => {
      const blockId = seedBlockIdRef.current
      if (!blockId) return
      const wrapper = editor.getWrapper()
      if (!wrapper || wrapper.components().length > 0) return
      const block = editor.Blocks.get(blockId)
      if (!block) return
      wrapper.append(block.get("content") as ComponentDefinition)
    })

    // Seed a brand-new single-post LAYOUT (reserved slug "single") with the
    // dynamic field blocks so the author opens onto a starter arrangement
    // instead of a blank canvas. Same empty-wrapper guard + append-fires-
    // autosave pattern as the `?seed=` path above. The four post-field types
    // are always registered (postFieldsPlugin), so the typed defs resolve.
    // ("single" mirrors SINGLE_POST_SLUG in post-template.ts — kept literal
    // here to avoid pulling that server module's prisma deps into the bundle.)
    editor.on("load", () => {
      const c = contentRef.current
      if (
        c.kind !== "template" ||
        c.template.kind !== "LAYOUT" ||
        c.template.slug !== "single"
      )
        return
      const wrapper = editor.getWrapper()
      if (!wrapper || wrapper.components().length > 0) return
      wrapper.append(DEFAULT_SINGLE_POST_SEED as object[])
    })

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
      // Cancel before the snapshot, not after the await: the freshest state
      // is read synchronously into formData on this same tick, so any queued
      // debounce payload is strictly stale — and cancelling first closes the
      // window where it could fire mid-save and rewrite `draftData` after
      // the server clears it.
      cancelPendingDraft()
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
      // GrapesJS keeps its own change counter, reset only by a successful
      // editor.store() — which this form-action commit path never goes
      // through. Its `noticeOnUnload` beforeunload guard reads that
      // counter, so without clearing it here, reload/tab-close would still
      // warn about "unsaved changes" right after a clean Save/Publish
      // (back/forward and in-app nav read editorSaveStore and stand down).
      editor?.clearDirtyCount()
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
    [saveAction, cancelPendingDraft]
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
                  <ContentSlotDeleteGuard />
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
