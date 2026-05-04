"use client"

import * as React from "react"
import GjsEditor, { Canvas } from "@grapesjs/react"
import { grapesjs, type Editor, type EditorConfig } from "grapesjs"
import gjsBlocksBasic from "grapesjs-blocks-basic"
import "grapesjs/dist/css/grapes.min.css"
import parserPostCSS from "grapesjs-parser-postcss"
import { designSystemPlugin } from "@/lib/plugins/design-system-plugin"
import { patternsPlugin } from "@/lib/plugins/patterns"

import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import LeftPanel from "./left-panel/left-panel"
import {
  LeftPanelProvider,
  useLeftPanel,
} from "./left-panel/left-panel-context"
import RightPanel from "./right-panel/right-panel"
import TopBar from "./top-bar/top-bar"
// Open Props is the source of truth for the design system. The bundle is
// copied into public/vendor/ by scripts/sync-vendor-css.mjs (predev /
// prebuild) so canvas.styles can load it by a stable, framework-agnostic URL.
// We don't use `import "open-props/...?url"` because Turbopack handles CSS as
// a side-effect import, not a URL import. Published pages must also serve
// /vendor/open-props.min.css for authored content to render correctly.
const OPEN_PROPS_PACKS = ["/vendor/open-props.min.css"]

const STORAGE_KEY = "tripcart:page-builder:project"

const gjsOptions: EditorConfig = {
  height: "100%",
  storageManager: {
    type: "local",
    autosave: true,
    autoload: true,
    stepsBeforeSave: 1,
    options: {
      local: { key: STORAGE_KEY },
    },
  },
  undoManager: {
    trackSelection: true,
    maximumStackLength: 500,
  },
  selectorManager: { componentFirst: true },
  // Default panels removed in favor of the WP-style React chrome.
  // The core:open-blocks / core:open-layers commands still exist; their
  // legacy panel targets are gone until React Sheets are added.
  panels: { defaults: [] },
  plugins: [parserPostCSS, designSystemPlugin, gjsBlocksBasic, patternsPlugin],
  canvas: {
    styles: OPEN_PROPS_PACKS,
  },
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

type PageRecord = {
  id: string
  title: string
  slug: string
  parentId: string | null
  path: string
  status: "DRAFT" | "PUBLISHED"
  updatedAt: Date
}

type ParentOption = {
  id: string
  title: string
  path: string
}

type Props = {
  page: PageRecord
  parentOptions: ParentOption[]
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
  page,
  parentOptions,
  saveAction,
  deleteAction,
}: Props) {
  const { open: leftOpen, setOpen: setLeftOpen } = useLeftPanel()

  const onEditor = React.useCallback((editor: Editor) => {
    if (typeof window !== "undefined") {
      ;(window as unknown as { editor: Editor }).editor = editor
    }
    attachTracking(editor)
  }, [])

  return (
    <form action={saveAction} className="contents">
      {/* Outer provider — controls the right (settings) sidebar. */}
      <SidebarProvider defaultOpen>
        <GjsEditor
          className="gjs-editor-root"
          grapesjs={grapesjs}
          options={gjsOptions}
          onEditor={onEditor}
        >
          <div className="flex h-dvh flex-col">
            <TopBar page={page} />

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
                <RightPanel
                  page={page}
                  parentOptions={parentOptions}
                  deleteAction={deleteAction}
                />
              </Sidebar>
            </div>
          </div>
        </GjsEditor>
      </SidebarProvider>
    </form>
  )
}
