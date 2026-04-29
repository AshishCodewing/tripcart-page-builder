"use client"

import * as React from "react"
import GjsEditor, { Canvas } from "@grapesjs/react"
import { grapesjs, type Editor, type EditorConfig } from "grapesjs"
import gjsBlocksBasic from "grapesjs-blocks-basic"
import "grapesjs/dist/css/grapes.min.css"

import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import InserterSidebar, { type InserterMode } from "./inserter-sidebar"
import PageSettingsSidebar from "./page-settings-sidebar"
import TopBar from "./top-bar"

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
  plugins: [gjsBlocksBasic],
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

export default function EditorShell({
  page,
  parentOptions,
  saveAction,
  deleteAction,
}: Props) {
  const [leftOpen, setLeftOpen] = React.useState(true)
  const [leftMode, setLeftMode] = React.useState<InserterMode>("blocks")

  const onEditor = React.useCallback((editor: Editor) => {
    if (typeof window !== "undefined") {
      ;(window as unknown as { editor: Editor }).editor = editor
    }
    attachTracking(editor)
  }, [])

  // Click toggles: same mode while open → close. Different mode → switch + open.
  const handleInserterClick = React.useCallback((mode: InserterMode) => {
    setLeftOpen((open) => {
      if (open && leftMode === mode) return false
      setLeftMode(mode)
      return true
    })
  }, [leftMode])

  const activeMode = leftOpen ? leftMode : null

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
            <TopBar
              page={page}
              activeMode={activeMode}
              onInserterClick={handleInserterClick}
            />

            <div className="flex flex-1 overflow-hidden">
              {/* Inner provider — controls the left (inserter) sidebar.
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
                  <InserterSidebar mode={leftMode} />
                </Sidebar>

                <SidebarInset className="bg-muted/20">
                  <Canvas className="grow gjs-custom-editor-canvas" />
                </SidebarInset>
              </SidebarProvider>

              <Sidebar
                side="right"
                collapsible="offcanvas"
                className="top-12 h-[calc(100svh-3rem)]"
              >
                <PageSettingsSidebar
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
